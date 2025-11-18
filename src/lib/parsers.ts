import type { MicroformatsEntry } from '../types/micropub.js';
import busboy from 'busboy';
import { Readable } from 'stream';

/**
 * Parse form-encoded data with bracket notation support
 * Example: category[]=foo&category[]=bar becomes { category: ['foo', 'bar'] }
 */
export function parseFormEncoded(body: string): Record<string, any> {
  const params = new URLSearchParams(body);
  const result: Record<string, any> = {};

  for (const [key, value] of params.entries()) {
    // Handle array notation (key[])
    if (key.endsWith('[]')) {
      const actualKey = key.slice(0, -2);
      if (!result[actualKey]) {
        result[actualKey] = [];
      }
      result[actualKey].push(value);
    } else {
      // For non-array keys, if we see it again, convert to array
      if (result[key] !== undefined) {
        if (Array.isArray(result[key])) {
          result[key].push(value);
        } else {
          result[key] = [result[key], value];
        }
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Convert form-encoded data to Microformats2 entry
 */
export function formToMicroformats(data: Record<string, any>): MicroformatsEntry {
  const type = data.h || 'entry';
  const properties: Record<string, any[]> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip 'h' and 'action' as they're not properties
    if (key === 'h' || key === 'action') {
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
export async function parseJSON(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('Invalid JSON');
  }
}

/**
 * Parse multipart/form-data
 */
export async function parseMultipart(
  request: Request
): Promise<{ fields: Record<string, any>; files: Array<{ field: string; file: File }> }> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, any> = {};
    const files: Array<{ field: string; file: File }> = [];

    const contentType = request.headers.get('content-type');
    if (!contentType) {
      reject(new Error('Missing content-type header'));
      return;
    }

    // Convert Web ReadableStream to Node.js Readable
    const reader = request.body?.getReader();
    if (!reader) {
      reject(new Error('No request body'));
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

    const bb = busboy({ headers: { 'content-type': contentType } });

    bb.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const chunks: Buffer[] = [];

      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const blob = new Blob([buffer], { type: mimeType });
        const webFile = new File([blob], filename, { type: mimeType });
        files.push({ field: fieldname, file: webFile });
      });
    });

    bb.on('field', (fieldname, value) => {
      // Handle array notation
      if (fieldname.endsWith('[]')) {
        const actualName = fieldname.slice(0, -2);
        if (!fields[actualName]) {
          fields[actualName] = [];
        }
        fields[actualName].push(value);
      } else {
        fields[fieldname] = value;
      }
    });

    bb.on('finish', () => {
      resolve({ fields, files });
    });

    bb.on('error', (error) => {
      reject(error);
    });

    nodeStream.pipe(bb);
  });
}

/**
 * Detect request content type
 */
export function getContentType(request: Request): string | null {
  const contentType = request.headers.get('content-type');
  if (!contentType) {
    return null;
  }

  // Extract the base content type (ignore charset and other parameters)
  return contentType.split(';')[0].trim().toLowerCase();
}

/**
 * Parse request body based on content type
 */
export async function parseRequest(
  request: Request
): Promise<{ data: any; files?: Array<{ field: string; file: File }> }> {
  const contentType = getContentType(request);

  if (!contentType) {
    throw new Error('Missing content-type header');
  }

  if (contentType === 'application/json') {
    const data = await parseJSON(request);
    return { data };
  }

  if (contentType === 'application/x-www-form-urlencoded') {
    const text = await request.text();
    const parsed = parseFormEncoded(text);
    return { data: parsed };
  }

  if (contentType === 'multipart/form-data') {
    const { fields, files } = await parseMultipart(request);
    return { data: fields, files };
  }

  throw new Error(`Unsupported content type: ${contentType}`);
}
