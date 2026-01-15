import { Readable } from "node:stream";
import busboy from "busboy";
import type { MicroformatsEntry } from "../types/micropub.js";

/** Default maximum file size during multipart parsing (10 MB) */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Error thrown when a file exceeds the maximum allowed size during streaming
 */
export class FileSizeLimitError extends Error {
  constructor(maxSize: number) {
    super(`File exceeds maximum size limit of ${maxSize} bytes`);
    this.name = "FileSizeLimitError";
  }
}

/**
 * Parse form-encoded data with bracket notation support
 * Example: category[]=foo&category[]=bar becomes { category: ['foo', 'bar'] }
 */
export function parseFormEncoded(body: string): Record<string, unknown> {
  const params = new URLSearchParams(body);
  const result: Record<string, unknown> = {};

  for (const [key, value] of params.entries()) {
    // Handle array notation (key[])
    if (key.endsWith("[]")) {
      const actualKey = key.slice(0, -2);
      if (!result[actualKey]) {
        result[actualKey] = [];
      }
      (result[actualKey] as unknown[]).push(value);
    } else if (result[key] !== undefined) {
      // For non-array keys, if we see it again, convert to array
      if (Array.isArray(result[key])) {
        (result[key] as unknown[]).push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Convert form-encoded data to Microformats2 entry
 */
export function formToMicroformats(
  data: Record<string, unknown>
): MicroformatsEntry {
  const type = data.h || "entry";
  const properties: Record<string, unknown[]> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip 'h' and 'action' as they're not properties
    if (key === "h" || key === "action") {
      continue;
    }

    // Ensure all values are arrays
    properties[key] = Array.isArray(value) ? value : [value];
  }

  return {
    type: [`h-${type}`],
    properties,
  };
}

/**
 * Parse JSON request body
 */
export async function parseJSON(
  request: Request
): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid JSON");
  }
}

/**
 * Parse multipart/form-data
 * @param request - The incoming request
 * @param maxFileSize - Maximum allowed file size in bytes (default: 10MB)
 */
export function parseMultipart(
  request: Request,
  maxFileSize: number = DEFAULT_MAX_FILE_SIZE
): Promise<{
  fields: Record<string, unknown>;
  files: Array<{ field: string; file: File }>;
}> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, unknown> = {};
    const files: Array<{ field: string; file: File }> = [];

    const contentType = request.headers.get("content-type");
    if (!contentType) {
      reject(new Error("Missing content-type header"));
      return;
    }

    // Convert Web ReadableStream to Node.js Readable
    const reader = request.body?.getReader();
    if (!reader) {
      reject(new Error("No request body"));
      return;
    }

    const nodeStream = new Readable({
      async read() {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      },
    });

    const bb = busboy({ headers: { "content-type": contentType } });

    bb.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const chunks: Buffer[] = [];
      let totalSize = 0;
      let sizeLimitExceeded = false;

      file.on("data", (data: Buffer) => {
        // Check size limit during streaming to prevent memory exhaustion
        totalSize += data.length;
        if (totalSize > maxFileSize) {
          sizeLimitExceeded = true;
          file.resume(); // Drain the stream
          return;
        }
        chunks.push(data);
      });

      file.on("end", () => {
        if (sizeLimitExceeded) {
          reject(new FileSizeLimitError(maxFileSize));
          return;
        }
        const buffer = Buffer.concat(chunks);
        const blob = new Blob([buffer], { type: mimeType });
        const webFile = new File([blob], filename, { type: mimeType });
        files.push({ field: fieldname, file: webFile });
      });
    });

    bb.on("field", (fieldname, value) => {
      // Handle array notation
      if (fieldname.endsWith("[]")) {
        const actualName = fieldname.slice(0, -2);
        if (!fields[actualName]) {
          fields[actualName] = [];
        }
        (fields[actualName] as unknown[]).push(value);
      } else {
        fields[fieldname] = value;
      }
    });

    bb.on("finish", () => {
      resolve({ fields, files });
    });

    bb.on("error", (error) => {
      reject(error);
    });

    nodeStream.pipe(bb);
  });
}

/**
 * Detect request content type
 */
export function getContentType(request: Request): string | null {
  const contentType = request.headers.get("content-type");
  if (!contentType) {
    return null;
  }

  // Extract the base content type (ignore charset and other parameters)
  return contentType.split(";")[0].trim().toLowerCase();
}

/**
 * Parse request body based on content type
 */
export async function parseRequest(request: Request): Promise<{
  data: Record<string, unknown>;
  files?: Array<{ field: string; file: File }>;
}> {
  const contentType = getContentType(request);

  if (!contentType) {
    throw new Error("Missing content-type header");
  }

  if (contentType === "application/json") {
    const data = await parseJSON(request);
    return { data };
  }

  if (contentType === "application/x-www-form-urlencoded") {
    const text = await request.text();
    const parsed = parseFormEncoded(text);
    return { data: parsed };
  }

  if (contentType === "multipart/form-data") {
    const { fields, files } = await parseMultipart(request);
    return { data: fields, files };
  }

  throw new Error(`Unsupported content type: ${contentType}`);
}
