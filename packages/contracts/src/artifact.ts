import {characterDeliverySchema} from './character';
import {z} from 'zod';
import {idSchema} from './primitives';
import {objectKeySchema} from './generation';
export const artifactProvenanceSchema=z.object({
 texture:z.enum(['mv-adapter','preset','uploaded']),preset:z.enum(['wood','metal','fabric']).optional(),researchOnly:z.boolean(),
 sources:z.array(z.object({name:z.string().min(1).max(200),revision:z.string().max(100),license:z.string().max(200)}).strict()).max(30).default([]),
}).strict().superRefine((p,ctx)=>{
 if(p.texture==='preset'&&!p.preset)ctx.addIssue({code:'custom',message:'PRESET_REQUIRED'});
 if(p.texture==='mv-adapter'&&!p.researchOnly)ctx.addIssue({code:'custom',message:'NVDIFFRAST_RESEARCH_ONLY'});
});
export const artifactManifestSchema=z.object({
 formatVersion:z.literal(1),jobId:idSchema,version:z.number().int().positive(),generation:z.number().int().nonnegative(),originalKey:objectKeySchema,
 desktop:z.object({key:objectKeySchema,triangles:z.number().int().positive(),drawCalls:z.number().int().positive(),dimensions:z.tuple([z.number().finite().nonnegative(),z.number().finite().nonnegative(),z.number().finite().nonnegative()]),textures:z.array(z.object({width:z.number().int().positive(),height:z.number().int().positive(),format:z.literal('ktx2')}).strict())}).strict(),
 provenance:artifactProvenanceSchema,character:characterDeliverySchema.optional(),
}).strict();
export type ArtifactManifest=z.infer<typeof artifactManifestSchema>;
export type ArtifactProvenance=z.input<typeof artifactProvenanceSchema>;
