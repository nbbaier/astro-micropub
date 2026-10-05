import { z } from "astro/zod";

/**
 * Micropub create request schema (JSON)
 */
const micropubCreateSchema = z.object({
  properties: z.record(z.string(), z.array(z.any())),
  type: z.array(z.string()).min(1),
});

/**
 * Micropub update request schema
 */
export const micropubUpdateSchema = z.object({
  action: z.literal("update"),
  add: z.record(z.string(), z.array(z.any())).optional(),
  delete: z
    .union([
      z.array(z.string()), // Delete entire properties
      z.record(z.string(), z.array(z.any())), // Delete specific values
    ])
    .optional(),
  replace: z.record(z.string(), z.array(z.any())).optional(),
  url: z.string().url(),
});

/**
 * Micropub delete request schema
 */
const micropubDeleteSchema = z.object({
  action: z.literal("delete"),
  url: z.string().url(),
});

/**
 * Micropub undelete request schema
 */
const micropubUndeleteSchema = z.object({
  action: z.literal("undelete"),
  url: z.string().url(),
});

/**
 * Micropub action request schema (update/delete/undelete)
 */
const micropubActionSchema = z.discriminatedUnion("action", [
  micropubUpdateSchema,
  micropubDeleteSchema,
  micropubUndeleteSchema,
]);

export type MicropubActionRequest = z.infer<typeof micropubActionSchema>;

/**
 * Validate a Micropub create request
 */
export function validateMicropubCreate(data: unknown) {
  return micropubCreateSchema.parse(data);
}

/**
 * Validate a Micropub action request
 */
export function validateMicropubAction(data: unknown) {
  return micropubActionSchema.parse(data);
}

/**
 * Convert update request to update operations
 */
import type { UpdateOperation } from "../types/micropub.js";

export function convertToUpdateOperations(
  update: z.infer<typeof micropubUpdateSchema>
): UpdateOperation[] {
  const operations: UpdateOperation[] = [];

  // Handle replace operations
  if (update.replace) {
    for (const [property, value] of Object.entries(update.replace)) {
      operations.push({
        action: "replace",
        property,
        value,
      });
    }
  }

  // Handle add operations
  if (update.add) {
    for (const [property, value] of Object.entries(update.add)) {
      operations.push({
        action: "add",
        property,
        value,
      });
    }
  }

  // Handle delete operations
  if (update.delete) {
    if (Array.isArray(update.delete)) {
      // Delete entire properties
      for (const property of update.delete) {
        operations.push({
          action: "delete",
          property,
        });
      }
    } else {
      // Delete specific values
      for (const [property, value] of Object.entries(update.delete)) {
        operations.push({
          action: "delete",
          property,
          value,
        });
      }
    }
  }

  return operations;
}
