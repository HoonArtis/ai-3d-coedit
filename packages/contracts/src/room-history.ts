import {z} from 'zod';
import {idSchema} from './primitives';
import {objectSchema} from './scene';
export const historyQuerySchema=z.object({objectId:idSchema.optional(),before:z.number().int().positive().optional(),limit:z.number().int().min(1).max(50).default(20)}).strict();
export const roomHistorySchema=z.object({entries:z.array(z.object({seq:z.number().int().positive(),actor:idSchema,source:z.string(),requestId:idSchema,changedIds:z.array(idSchema),snapshotId:idSchema,before:objectSchema.nullable().optional(),after:objectSchema.nullable().optional()}).strict()),nextCursor:z.number().int().positive().nullable()}).strict();
export type RoomHistoryPage=z.infer<typeof roomHistorySchema>;
