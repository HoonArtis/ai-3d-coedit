import {expect,test} from 'vitest';
import {createHash} from 'node:crypto';
import {Document,NodeIO} from '@gltf-transform/core';
import {publishArtifact} from '../../apps/workers/src/optimization/publish';
import type {ObjectStore} from '@coedit/artifacts';
async function mesh(){
 const doc=new Document(),b=doc.createBuffer(),p=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0])).setBuffer(b));
 doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(p)));return new NodeIO().writeBinary(doc);
}
test('publishes immutable linked original/desktop manifest only after every object is saved; retry recovers',async()=>{
 const objects=new Map<string,Uint8Array>();let calls=0,fail=true;
 const store:ObjectStore={put:async bytes=>{if(++calls===2&&fail)throw Error('STORAGE_OFFLINE');const key=createHash('sha256').update(bytes).digest('hex');objects.set(key,bytes);return key;},get:async key=>{const bytes=objects.get(key);if(!bytes)throw Error('MISSING');return bytes;}};
 const input={jobId:'job-one',version:1,generation:0,raw:await mesh(),provenance:{texture:'preset' as const,preset:'wood' as const,researchOnly:false}};
 await expect(publishArtifact(store,input)).rejects.toThrow('STORAGE_OFFLINE');
 expect(objects.size).toBe(1);fail=false;
 const result=await publishArtifact(store,input),saved=JSON.parse(new TextDecoder().decode(await store.get(result.artifactId)));
 expect(saved).toEqual(result.manifest);expect(saved.jobId).toBe('job-one');expect(saved.originalKey).toMatch(/^[a-f0-9]{64}$/);expect(saved.desktop.triangles).toBe(1);
 expect(await store.get(saved.originalKey)).toEqual(input.raw);await expect(store.get(saved.desktop.key)).resolves.toBeDefined();
 expect((await publishArtifact(store,input)).artifactId).toBe(result.artifactId);
});
