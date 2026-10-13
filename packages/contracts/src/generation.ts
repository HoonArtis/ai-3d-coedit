import {characterSourceSchema} from './character';
import {z} from 'zod';
import {idSchema,objectKeySchema} from './primitives';
import {finishingRecordSchema} from './finishing';
export {objectKeySchema} from './primitives';
export const generationSourceSchema=z.discriminatedUnion('kind',[characterSourceSchema,
 z.object({kind:z.literal('text'),prompt:z.string().trim().min(1).max(2000)}).strict(),
 z.object({kind:z.literal('upload'),imageKey:objectKeySchema}).strict(),
]);
export const generationRequestSchema=z.object({requestId:idSchema,source:generationSourceSchema,jobId:idSchema.optional(),expectedVersion:z.number().int().positive().optional()}).strict().refine(v=>(v.jobId===undefined)===(v.expectedVersion===undefined),'Regeneration requires job and version');
export type GenerationRequest=z.infer<typeof generationRequestSchema>;
export const retextureTargetSchema=z.object({objectId:idSchema,revision:z.number().int().nonnegative(),generation:z.number().int().nonnegative(),assetId:idSchema}).strict();
export const retexturePreparedSchema=z.object({shapeKey:objectKeySchema,imageKey:objectKeySchema.optional(),target:retextureTargetSchema}).strict();
export type RetexturePrepared=z.infer<typeof retexturePreparedSchema>;
export const generationStateSchema=z.enum(['image_queued','awaiting_confirmation','shape_queued','shape_ready','failed']);
export const generationRecordSchema=z.object({id:idSchema,actor:idSchema,roomId:idSchema,generation:z.number().int().nonnegative(),version:z.number().int().positive(),state:generationStateSchema,source:generationSourceSchema,imageKey:objectKeySchema.nullable(),shapeKey:objectKeySchema.nullable(),error:z.string().nullable(),target:retextureTargetSchema.nullable().optional()});
export type GenerationRecord=z.infer<typeof generationRecordSchema>;
export const generationProgressSchema=generationRecordSchema.extend({position:z.number().int().nonnegative(),running:z.boolean(),finishing:finishingRecordSchema.nullable().optional()});
export const generationListSchema=z.object({jobs:z.array(generationProgressSchema),usage:z.object({used:z.number().int().nonnegative(),limit:z.number().int().nonnegative()})});
export const confirmImageSchema=z.object({version:z.number().int().positive()}).strict();
