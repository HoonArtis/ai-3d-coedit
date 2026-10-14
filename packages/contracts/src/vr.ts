import {z} from 'zod';
import {blockAvatarSchema} from './avatar-profile';
import {idSchema,objectKeySchema,vec3Schema} from './primitives';
import {snapshotSchema,librarySchema} from './scene';
import {BUDGETS} from './budgets';
import {artifactProvenanceSchema} from './artifact';
export const submissionSchema=z.object({id:idSchema,roomId:idSchema,seq:z.number().int().nonnegative(),generation:z.number().int().nonnegative(),objectKey:objectKeySchema}).strict();
export const vrSourceSchema=z.object({formatVersion:z.literal(1),snapshotId:idSchema,snapshot:snapshotSchema,library:librarySchema}).strict().superRefine((source,ctx)=>{
  if(Object.keys(source.snapshot.objects).length>BUDGETS.roomAssets)ctx.addIssue({code:'custom',message:'ASSET_LIMIT'});
  if(Object.values(source.snapshot.objects).some(object=>!Object.hasOwn(source.library,object.assetId)))ctx.addIssue({code:'custom',message:'ASSET_UNAVAILABLE'});
});
export const vrBakeRecordSchema=z.object({snapshotId:idSchema,roomId:idSchema,seq:z.number().int().nonnegative(),generation:z.number().int().nonnegative(),state:z.enum(['queued','ready','failed']),manifestId:objectKeySchema.nullable(),error:z.string().nullable()}).strict().refine(row=>(row.state==='ready')===(row.manifestId!==null),'Only completed bakes expose a manifest');
export type VrSource=z.infer<typeof vrSourceSchema>;
export type VrBakeRecord=z.infer<typeof vrBakeRecordSchema>;
export const vrManifestSchema=z.object({
 formatVersion:z.literal(1),snapshotId:idSchema,roomId:idSchema,seq:z.number().int().nonnegative(),generation:z.number().int().nonnegative(),sourceKey:objectKeySchema,key:objectKeySchema,
 objects:z.array(idSchema).max(BUDGETS.roomAssets),triangles:z.number().int().min(0).max(BUDGETS.vrRoomTriangles),drawCalls:z.number().int().min(0).max(BUDGETS.vrDrawCalls),
 assets:z.array(z.object({id:idSchema,triangles:z.number().int().positive().max(BUDGETS.vrAssetTriangles)}).strict()).max(BUDGETS.roomAssets),
 textures:z.array(z.object({width:z.literal(1024),height:z.literal(1024),format:z.literal('ktx2')}).strict()).max(BUDGETS.vrDrawCalls),
 provenance:z.array(artifactProvenanceSchema).max(BUDGETS.roomAssets),researchOnly:z.boolean(),
}).strict().superRefine((m,ctx)=>{
 if(new Set(m.objects).size!==m.objects.length||new Set(m.assets.map(a=>a.id)).size!==m.assets.length)ctx.addIssue({code:'custom',message:'DUPLICATE_VR_COVERAGE'});
 if(m.researchOnly!==m.provenance.some(p=>p.researchOnly))ctx.addIssue({code:'custom',message:'VR_PROVENANCE_MISMATCH'});
 if((m.objects.length===0)!==(m.triangles===0)||(m.triangles===0)!==(m.drawCalls===0))ctx.addIssue({code:'custom',message:'VR_EMPTY_MISMATCH'});
});
export type VrManifest=z.infer<typeof vrManifestSchema>;
const boundVector=z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]);
export const vrEnvironmentSchema=z.object({manifest:vrManifestSchema,obstacles:z.array(z.object({min:boundVector,max:boundVector}).strict().refine(b=>b.min.every((n,i)=>n<=b.max[i]))).max(BUDGETS.roomAssets),spawn:vec3Schema.nullable()}).strict();
export type VrEnvironment=z.infer<typeof vrEnvironmentSchema>;
const trackedPoseSchema=z.object({position:z.tuple([z.number().finite().min(-50).max(50),z.number().finite().min(-2).max(5),z.number().finite().min(-50).max(50)]),quaternion:z.tuple([z.number().finite(),z.number().finite(),z.number().finite(),z.number().finite()]).refine(q=>Math.abs(Math.hypot(...q)-1)<.01)}).strict();
export const vrPoseSchema=z.object({seq:z.number().int().nonnegative(),head:trackedPoseSchema,left:trackedPoseSchema.nullable(),right:trackedPoseSchema.nullable()}).strict();
export const vrAvatarsSchema=z.object({avatars:z.array(vrPoseSchema.extend({actor:idSchema,connectionId:idSchema,avatarId:objectKeySchema.nullable().optional(),blockAvatar:blockAvatarSchema.nullable().optional()}).strict()).max(5)}).strict();
export type VrPose=z.infer<typeof vrPoseSchema>;
export type VrAvatar=z.infer<typeof vrAvatarsSchema>['avatars'][number];
