import {artifactManifestSchema,objectKeySchema,type JobInput} from '@coedit/contracts';
import type {ObjectStore} from '@coedit/artifacts';
import {convertCharacter,inspectCharacterGlb} from './convert';
import {compressGlbTextures,inspectKtx2} from '../optimization/texture';
import {readGlb} from '../optimization/mesh';
export async function characterJob(store:ObjectStore,input:JobInput){
 if(input.stage!=='character')throw Error('STAGE_UNAVAILABLE');
 const originalKey=objectKeySchema.parse(input.payload.inputKey),result=await convertCharacter(await store.get(originalKey),input.payload.format);
 const desktop=await compressGlbTextures(result.desktop.bytes),avatar=await compressGlbTextures(result.avatar.bytes),stats=await inspectCharacterGlb(desktop,5000),avatarStats=await inspectCharacterGlb(avatar,10000);
 const doc=await readGlb(desktop),textures=doc.getRoot().listTextures().map(t=>{if(t.getMimeType()!=='image/ktx2')throw Error('CHARACTER_TEXTURE');const info=inspectKtx2(t.getImage()!);return {width:info.width,height:info.height,format:'ktx2' as const};});
 if(textures.length>8)throw Error('CHARACTER_TEXTURE_BUDGET');
 const key=await store.put(desktop),avatarKey=await store.put(avatar),vrKey=await store.put(result.vr.bytes);
 const manifest=artifactManifestSchema.parse({formatVersion:1,jobId:input.jobId,version:input.inputVersion,generation:input.generation,originalKey,desktop:{key,triangles:stats.triangles,drawCalls:stats.drawCalls,dimensions:stats.dimensions,textures},character:{avatarKey,vrKey,joints:stats.joints,clips:stats.clips,avatarTriangles:avatarStats.triangles},provenance:{texture:'uploaded',researchOnly:false,sources:[{name:'Student supplied rig and textures',revision:'upload',license:'User must have rights to uploaded content'},{name:'Blender',revision:'5.1.2',license:'GPL-3.0-or-later (converter; output is not automatically GPL)'}]}});
 const artifactId=await store.put(new TextEncoder().encode(JSON.stringify(manifest)));return {artifactId,manifest};
}
