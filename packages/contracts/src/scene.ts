import { z } from 'zod';
import { idSchema, vec3Schema, scaleSchema,objectKeySchema, type Session, type Vec3 } from './primitives';
export const objectSchema = z.object({
  id:idSchema, assetId:idSchema, owner:idSchema, name:z.string().min(1).max(80),
  position:vec3Schema, rotation:vec3Schema, scale:scaleSchema,
  revision:z.number().int().nonnegative(), lastActor:idSchema,
}).strict();
export const snapshotSchema = z.object({
  version:z.literal(1),roomId:idSchema,generation:z.number().int().nonnegative(),
  seq:z.number().int().nonnegative(),objects:z.record(idSchema,objectSchema),
}).strict().refine(s => Object.entries(s.objects).every(([key,obj]) => key===obj.id), 'Object key mismatch');
export type SceneObject = z.infer<typeof objectSchema>;
export type SceneSnapshot = z.infer<typeof snapshotSchema>;
export const parseSnapshot = (value:unknown):SceneSnapshot => snapshotSchema.parse(value);
export const assetDefinitionSchema=z.object({id:idSchema,name:z.string().min(1).max(80),kind:z.enum(['chair','table','tree','bench','plant','cube','generated']),color:z.string().regex(/^#[a-fA-F0-9]{6}$/),dimensions:vec3Schema.refine(v=>v.every(n=>n>=0)),artifactId:objectKeySchema.optional(),character:z.boolean().optional()}).strict().refine(a=>(a.kind==='generated')===(a.artifactId!==undefined),'Generated assets require artifact identity');
export type AssetDefinition=z.infer<typeof assetDefinitionSchema>;
export const librarySchema=z.record(idSchema,assetDefinitionSchema).refine(v=>Object.entries(v).every(([id,a])=>id===a.id),'Asset key mismatch');
export type Lease = {owner:string; token:string};
export type CommandContext = Session & {library:Record<string,AssetDefinition>; locks:Record<string,Lease>};
export type CommandResult =
  | {ok:true; snapshot:SceneSnapshot; changedIds:string[]; query?:SceneObject[]}
  | {ok:false; code:string; message:string};
export function emptyScene(roomId='local-room'):SceneSnapshot {
  return {version:1,roomId,generation:0,seq:0,objects:{}};
}
