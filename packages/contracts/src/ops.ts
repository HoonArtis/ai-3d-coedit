import { z } from 'zod';
import { idSchema as id, idsSchema as ids, vec3Schema as vec, scaleSchema as scale } from './primitives';
const axis = z.enum(['x','y','z']);
const prompt = z.string().trim().min(1).max(2000);
export const opSchema = z.discriminatedUnion('op', [
  z.object({op:z.literal('place'), id, assetId:id, position:vec, rotation:vec.default([0,0,0]), scale:scale.default([1,1,1])}).strict(),
  z.object({op:z.literal('move'), id, value:vec}).strict(),
  z.object({op:z.literal('rotate'), id, value:vec}).strict(),
  z.object({op:z.literal('scale'), id, value:scale}).strict(),
  z.object({op:z.literal('duplicate'), id, newId:id}).strict(),
  z.object({op:z.literal('delete'), id}).strict(),
  z.object({op:z.literal('rename'), id, name:z.string().trim().min(1).max(80)}).strict(),
  z.object({op:z.literal('snap_to_ground'), id}).strict(),
  z.object({op:z.literal('generate'), prompt}).strict(),
  z.object({op:z.literal('upload_character'), uploadId:id}).strict(),
  z.object({op:z.literal('retexture'), id, prompt}).strict(),
  z.object({op:z.literal('replace_asset'),id,assetId:id,expectedRevision:z.number().int().nonnegative(),expectedGeneration:z.number().int().nonnegative()}).strict(),
  z.object({op:z.literal('arrange_around'), targetId:id, assetId:id, ids, radius:z.number().finite().positive().max(1000)}).strict(),
  z.object({op:z.literal('align_row'), ids, axis, spacing:z.number().finite().positive().max(1000)}).strict(),
  z.object({op:z.literal('distribute'), ids, axis}).strict(),
  z.object({op:z.literal('scatter'), assetId:id, ids, min:vec, max:vec, seed:z.number().int().nonnegative().max(4294967295)}).strict(),
  z.object({op:z.literal('place_on'), id, targetId:id}).strict(),
  z.object({op:z.literal('face_toward'), id, targetId:id}).strict(),
  z.object({op:z.literal('arrange_nicely'), ids}).strict(),
  z.object({op:z.literal('list')}).strict(),
  z.object({op:z.literal('find'), query:z.string().max(80)}).strict(),
  z.object({op:z.literal('describe_scene')}).strict(),
  z.object({op:z.literal('recommend'), focusId:id.optional()}).strict(),
  z.object({op:z.literal('undo'),expectedSeq:z.number().int().positive().optional()}).strict(), z.object({op:z.literal('redo')}).strict(),
  z.object({op:z.literal('lock'), ids}).strict(), z.object({op:z.literal('unlock'), ids}).strict(),
  z.object({op:z.literal('force_unlock'), ids}).strict(),
  z.object({op:z.literal('approve_asset'), artifactId:id}).strict(),
  z.object({op:z.literal('restore_object'), id, revision:z.number().int().nonnegative()}).strict(),
  z.object({op:z.literal('restore_snapshot'), snapshotId:id}).strict(),
  z.object({op:z.literal('read_logs'), studentId:id}).strict(),
]);
export type Op = z.infer<typeof opSchema>;
