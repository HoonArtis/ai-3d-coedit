import {test,expect} from 'vitest';
import {Document,NodeIO} from '@gltf-transform/core';
import {SphereGeometry} from 'three';
import {optimizeStaticGlb,inspectGlb} from '../../apps/workers/src/optimization/mesh';
async function sphere(){
 const geometry=new SphereGeometry(1,128,64),doc=new Document(),buffer=doc.createBuffer();
 const positions=doc.createAccessor().setType('VEC3').setArray(new Float32Array(geometry.attributes.position.array)).setBuffer(buffer);
 const indices=doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(geometry.index!.array)).setBuffer(buffer);
 const primitive=doc.createPrimitive().setAttribute('POSITION',positions).setIndices(indices);
 const mesh=doc.createMesh().addPrimitive(primitive),node=doc.createNode().setMesh(mesh);doc.createScene().addChild(node);geometry.dispose();return new NodeIO().writeBinary(doc);
}
test('static GLB is reduced below desktop/VR triangle budget with finite bounds and grounded pivot',async()=>{
 const input=await sphere();expect((await inspectGlb(input)).triangles).toBeGreaterThan(5000);
 const desktop=await optimizeStaticGlb(input,'desktop');
 expect(desktop.stats.triangles).toBeLessThanOrEqual(5000);expect(desktop.stats.triangles).toBeGreaterThan(100);
 expect(desktop.stats.bounds.min[1]).toBeCloseTo(0,4);
 expect(desktop.stats.bounds.max[1]).toBeGreaterThan(1.8);
 const vr=await optimizeStaticGlb(desktop.bytes,'vr');expect(vr.stats.triangles).toBeLessThanOrEqual(2500);
 expect((await inspectGlb(vr.bytes)).triangles).toBe(vr.stats.triangles);
});
test('corrupt, empty and degenerate mesh results are not registered as valid artifacts',async()=>{
 await expect(optimizeStaticGlb(new Uint8Array([1,2,3]),'desktop')).rejects.toThrow();
 const doc=new Document();doc.createScene();await expect(optimizeStaticGlb(await new NodeIO().writeBinary(doc),'desktop')).rejects.toThrow('EMPTY_MESH');
 const input=await sphere(),parsed=await new NodeIO().readBinary(input);parsed.getRoot().listAccessors().find(a=>a.getType()==='VEC3')!.getArray()!.fill(0);
 await expect(optimizeStaticGlb(await new NodeIO().writeBinary(parsed),'desktop')).rejects.toThrow('DEGENERATE_MESH');
});
