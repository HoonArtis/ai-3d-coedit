import {z} from 'zod';
import {idSchema,objectKeySchema} from './primitives';
export const materialPresetSchema=z.enum(['wood','metal','fabric']);
export const finishingRecordSchema=z.object({jobId:idSchema,version:z.number().int().positive(),phase:z.enum(['texture_queued','material_choice','optimize_queued','pending_approval','approved','rejected','failed']),preset:materialPresetSchema.nullable(),textureKey:objectKeySchema.nullable(),artifactId:objectKeySchema.nullable(),error:z.string().nullable(),staleScene:z.boolean()});
export type FinishingRecord=z.infer<typeof finishingRecordSchema>;
