import {test,expect} from 'vitest';import {createHash} from 'node:crypto';
import {BUILTIN_LIBRARY,emptyScene,type JobInput} from '@coedit/contracts';
import type {ObjectStore} from '@coedit/artifacts';
import {bakeVrJob} from '../../apps/workers/src/vr/job';
import {inspectGlb,readGlb} from '../../apps/workers/src/optimization/mesh';
import {inspectKtx2} from '../../apps/workers/src/optimization/texture';
function memory(){const entries=new Map<string,Uint8Array>();const store:ObjectStore={async put(bytes){const key=createHash('sha256').update(bytes).digest('hex');entries.set(key,bytes.slice());return key;},async get(key){const bytes=entries.get(key);if(!bytes)throw Error('NOT_FOUND');return bytes.slice();}};return {store,entries};}
test('VR job publishes immutable verified KTX2 output, complete object coverage and bound snapshot identity',async()=>{
 const {store,entries}=memory(),snapshot=emptyScene('room');snapshot.seq=7;
 for(let i=0;i<200;i++)snapshot.objects[`obj-${i}`]={id:`obj-${i}`,assetId:'cube',owner:'student',name:'cube',position:[i%20,0,Math.floor(i/20)],rotation:[0,0,0],scale:[1,1,1],revision:1,lastActor:'student'};
 const sourceKey=await store.put(new TextEncoder().encode(JSON.stringify({formatVersion:1,snapshotId:'snapshot',snapshot,library:{cube:BUILTIN_LIBRARY.cube}})));
 const input:JobInput={stage:'vr-bake',jobId:'snapshot',inputVersion:1,roomId:'room',actor:'student',generation:0,payload:{sourceKey}};
 const before=await store.get(sourceKey),result=await bakeVrJob(store,input);
 expect(result.manifest.seq).toBe(7);expect(result.manifest.objects).toHaveLength(200);expect(result.manifest.triangles).toBe(2400);expect(result.manifest.drawCalls).toBe(1);
 expect(await store.get(sourceKey)).toEqual(before);expect(JSON.parse(new TextDecoder().decode(await store.get(result.manifestId)))).toEqual(result.manifest);
 const bytes=await store.get(result.manifest.key);expect((await inspectGlb(bytes)).drawCalls).toBe(1);
 for(const texture of (await readGlb(bytes)).getRoot().listTextures())expect(inspectKtx2(texture.getImage()!)).toMatchObject({width:1024,height:1024,levels:11});
 const count=entries.size;await expect(bakeVrJob(store,{...input,roomId:'foreign'})).rejects.toThrow('VR_SOURCE_MISMATCH');expect(entries.size).toBe(count);
},120000);
test('empty submission remains a valid empty viewing scene',async()=>{
 const {store}=memory(),sourceKey=await store.put(new TextEncoder().encode(JSON.stringify({formatVersion:1,snapshotId:'empty',snapshot:emptyScene('room'),library:{}})));
 const result=await bakeVrJob(store,{stage:'vr-bake',jobId:'empty',inputVersion:1,roomId:'room',actor:'student',generation:0,payload:{sourceKey}});
 expect(result.manifest.objects).toEqual([]);expect(result.manifest.triangles).toBe(0);expect((await readGlb(await store.get(result.manifest.key))).getRoot().listMeshes()).toHaveLength(0);
});
