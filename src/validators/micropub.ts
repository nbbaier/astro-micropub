import { z } from 'zod';

/**
 * Microformats2 entry schema
 */
export const microformatsEntrySchema = z.object({
  type: z.array(z.string()).min(1),
  properties: z.record(z.array(z.any())),
});

/**
 * Update operation schema
 */
export const updateOperationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('replace'),
    property: z.string(),
    value: z.array(z.any()),
  }),
  z.object({
    action: z.literal('add'),
    property: z.string(),
    value: z.array(z.any()),
  }),
  z.object({
    action: z.literal('delete'),
    property: z.string(),
    value: z.array(z.any()).optional(),
  }),
]);

/**
 * Micropub create request schema (JSON)
 */
export const micropubCreateSchema = z.object({
  type: z.array(z.string()).min(1),
  properties: z.record(z.array(z.any())),
});

/**
 * Micropub update request schema
 */
export const micropubUpdateSchema = z.object({
  action: z.literal('update'),
  url: z.string().url(),
  replace: z.record(z.array(z.any())).optional(),
  add: z.record(z.array(z.any())).optional(),
  delete: z.union([
    z.array(z.string()), // Delete entire properties
    z.record(z.array(z.any())), // Delete specific values
  ]).optional(),
});

/**
 * Micropub delete request schema
 */
export const micropubDeleteSchema = z.object({
  action: z.literal('delete'),
  url: z.string().url(),
});

/**
 * Micropub undelete request schema
 */
export const micropubUndeleteSchema = z.object({
  action: z.literal('undelete'),
  url: z.string().url(),
});

/**
 * Micropub action request schema (update/delete/undelete)
 */
export const micropubActionSchema = z.discriminatedUnion('action', [
  micropubUpdateSchema,
  micropubDeleteSchema,
  micropubUndeleteSchema,
]);

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
export function convertToUpdateOperations(update: z.infer<typeof micropubUpdateSchema>) {
  const operations: Array<{
    action: 'replace' | 'add' | 'delete';
    property: string;
    value?: any[];
  }> = [];

  // Handle replace operations
  if (update.replace) {
    for (const [property, value] of Object.entries(update.replace)) {
      operations.push({
        action: 'replace',
        property,
        value,
      });
    }
  }

  // Handle add operations
  if (update.add) {
    for (const [property, value] of Object.entries(update.add)) {
      operations.push({
        action: 'add',
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
          action: 'delete',
          property,
        });
      }
    } else {
      // Delete specific values
      for (const [property, value] of Object.entries(update.delete)) {
        operations.push({
          action: 'delete',
          property,
          value,
        });
      }
    }
  }

  return operations;
}
