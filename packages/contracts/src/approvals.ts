import {z} from 'zod';
import {idSchema} from './primitives';
import {assetDefinitionSchema} from './scene';
import {artifactManifestSchema} from './artifact';
export const approvalListSchema=z.array(z.object({jobId:idSchema,version:z.number().int().positive(),phase:z.enum(['pending_approval','approved','rejected']),actor:idSchema,generation:z.number().int().nonnegative(),asset:assetDefinitionSchema,manifest:artifactManifestSchema}).strict());
export type ApprovalRecord=z.infer<typeof approvalListSchema>[number];
export const assetHistorySchema=z.array(z.object({
 jobId:idSchema,version:z.number().int().positive(),asset:assetDefinitionSchema,actor:idSchema,
 createdAt:z.iso.datetime(),roomId:idSchema,roomName:z.string(),shared:z.boolean(),canShare:z.boolean(),
}).strict());
export type AssetHistoryRecord=z.infer<typeof assetHistorySchema>[number];
