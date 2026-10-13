import {artifactManifestSchema,artifactProvenanceSchema,checkArtifactBudgets,type ArtifactProvenance} from '@coedit/contracts';
import type {ObjectStore} from '@coedit/artifacts';
import {optimizeStaticGlb} from './mesh';
import {compressGlbTextures} from './texture';
import {verifyArtifact} from './verify';
export async function publishArtifact(store:ObjectStore,input:{jobId:string;version:number;generation:number;raw:Uint8Array;provenance:ArtifactProvenance}){
 const provenance=artifactProvenanceSchema.parse(input.provenance);
 const optimized=await optimizeStaticGlb(input.raw,'desktop'),bytes=await compressGlbTextures(optimized.bytes),stats=await verifyArtifact(bytes,'desktop');
 const textures=stats.textures.map(t=>{if(!t.size)throw Error('MISSING_TEXTURE_SIZE');return {width:t.size[0],height:t.size[1],format:'ktx2' as const};});
 const violations=checkArtifactBudgets({target:'desktop',assetCount:1,triangles:stats.triangles,drawCalls:stats.drawCalls,assets:[{triangles:stats.triangles}],textures,avatars:[]});
 if(violations.length)throw Error('ARTIFACT_BUDGET_EXCEEDED');
 const originalKey=await store.put(input.raw),key=await store.put(bytes);
 // Consumers can register only the final manifest. Partial uploads are immutable and safe to retry.
 const manifest=artifactManifestSchema.parse({formatVersion:1,jobId:input.jobId,version:input.version,generation:input.generation,originalKey,desktop:{key,triangles:stats.triangles,drawCalls:stats.drawCalls,dimensions:stats.dimensions,textures},provenance});
 const artifactId=await store.put(new TextEncoder().encode(JSON.stringify(manifest)));
 return {artifactId,manifest};
}
