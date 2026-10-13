import {Document,NodeIO} from '@gltf-transform/core';
import {vrSourceSchema,vrManifestSchema,objectKeySchema,artifactManifestSchema,BUDGETS,type JobInput,type ArtifactManifest} from '@coedit/contracts';
import type {ObjectStore} from '@coedit/artifacts';
import {builtinParts,glbParts,placeParts,type MeshPart} from './parts';
import {mergeAtlas} from './atlas';
import {optimizeStaticGlb,inspectGlb,readGlb} from '../optimization/mesh';
import {compressGlbTextures,inspectKtx2} from '../optimization/texture';
export async function bakeVrJob(store:ObjectStore,input:JobInput){
 if(input.stage!=='vr-bake')throw Error('STAGE_UNAVAILABLE');
 const sourceKey=objectKeySchema.parse(input.payload.sourceKey),source=vrSourceSchema.parse(JSON.parse(new TextDecoder().decode(await store.get(sourceKey))));
 if(source.snapshotId!==input.jobId||source.snapshot.roomId!==input.roomId||source.snapshot.generation!==input.generation||input.inputVersion!==1)throw Error('VR_SOURCE_MISMATCH');
 const cached=new Map<string,MeshPart[]>(),assets:{id:string;triangles:number}[]=[],provenance:ArtifactManifest['provenance'][]=[];
 const objects=Object.values(source.snapshot.objects),parts:MeshPart[]=[];
 for(const object of objects){
  let assetParts=cached.get(object.assetId);
  if(!assetParts){
   const asset=source.library[object.assetId];
   if(asset.kind==='generated'){
    const artifact=artifactManifestSchema.parse(JSON.parse(new TextDecoder().decode(await store.get(asset.artifactId!))));
    const original=await store.get(artifact.character?.vrKey??artifact.originalKey),optimized=await optimizeStaticGlb(original,'vr');
    assetParts=await glbParts(optimized.bytes);provenance.push(artifact.provenance);
   }else assetParts=builtinParts(asset);
   const triangles=assetParts.reduce((n,p)=>n+p.indices.length/3,0);
   if(triangles>BUDGETS.vrAssetTriangles)throw Error('VR_ASSET_BUDGET_EXCEEDED');
   cached.set(object.assetId,assetParts);assets.push({id:object.assetId,triangles});
  }
  parts.push(...placeParts(assetParts,object));
 }
 const expectedTriangles=parts.reduce((n,p)=>n+p.indices.length/3,0);
 if(expectedTriangles>BUDGETS.vrRoomTriangles)throw Error('VR_ROOM_BUDGET_EXCEEDED');
 let bytes:Uint8Array,coverage:string[]=[];
 if(parts.length){const merged=await mergeAtlas(parts);coverage=merged.objects;bytes=await compressGlbTextures(merged.bytes);}
 else {const empty=new Document();empty.createScene();bytes=await new NodeIO().writeBinary(empty);}
 if(JSON.stringify(coverage)!==JSON.stringify(objects.map(o=>o.id).sort()))throw Error('VR_OBJECT_LOSS');
 const stats=parts.length?await inspectGlb(bytes):{triangles:0,drawCalls:0};
 if(stats.triangles!==expectedTriangles||stats.drawCalls>BUDGETS.vrDrawCalls)throw Error('VR_MERGE_MISMATCH');
 const doc=await readGlb(bytes),textures=doc.getRoot().listTextures().map(texture=>{
  if(texture.getMimeType()!=='image/ktx2')throw Error('VR_TEXTURE_FORMAT');
  const info=inspectKtx2(texture.getImage()!);if(info.width!==1024||info.height!==1024)throw Error('VR_TEXTURE_SIZE');
  return {width:1024 as const,height:1024 as const,format:'ktx2' as const};
 });
 // Original artifacts and the submitted scene are immutable; publish the manifest last.
 const key=await store.put(bytes),manifest=vrManifestSchema.parse({formatVersion:1,snapshotId:source.snapshotId,roomId:source.snapshot.roomId,seq:source.snapshot.seq,generation:source.snapshot.generation,sourceKey,key,objects:coverage,triangles:stats.triangles,drawCalls:stats.drawCalls,assets,textures,provenance,researchOnly:provenance.some(p=>p.researchOnly)});
 const manifestId=await store.put(new TextEncoder().encode(JSON.stringify(manifest)));return {manifestId,manifest};
}
