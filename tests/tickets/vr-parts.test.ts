import {test,expect} from 'vitest';
import {Document,NodeIO} from '@gltf-transform/core';
import {BUILTIN_LIBRARY,type SceneObject} from '@coedit/contracts';
import {builtinParts,glbParts,placeParts} from '../../apps/workers/src/vr/parts';
const object:SceneObject={id:'one',assetId:'cube',owner:'student',name:'cube',position:[3,2,-4],rotation:[0,Math.PI/2,0],scale:[2,3,4],revision:1,lastActor:'student'};
test('VR parts preserve builtin geometry, object transforms, unit normals and source buffers',()=>{
 const parts=builtinParts(BUILTIN_LIBRARY.cube),original=parts[0].positions.slice();
 const placed=placeParts(parts,object),coordinates=placed.flatMap(p=>Array.from(p.positions));
 const axis=(n:number)=>coordinates.filter((_,i)=>i%3===n);
 expect([Math.min(...axis(0)),Math.min(...axis(1)),Math.min(...axis(2))]).toEqual([1,2,-5]);
 expect([Math.max(...axis(0)),Math.max(...axis(1)),Math.max(...axis(2))]).toEqual([5,5,-3]);
 expect(parts[0].positions).toEqual(original);
 for(const part of placed){expect(part.objectId).toBe('one');for(let i=0;i<part.normals.length;i+=3)expect(Math.hypot(...part.normals.slice(i,i+3))).toBeCloseTo(1);}
 for(const asset of Object.values(BUILTIN_LIBRARY))expect(builtinParts(asset).reduce((sum,p)=>sum+p.indices.length/3,0)).toBeLessThanOrEqual(2500);
});
async function fixture(unsupported=false){
 const doc=new Document(),buffer=doc.createBuffer();
 const pos=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0])).setBuffer(buffer);
 const material=doc.createMaterial().setBaseColorFactor([.2,.3,.4,1]);
 if(unsupported)material.setEmissiveFactor([1,0,0]);
 const mesh=doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION',pos).setMaterial(material));
 doc.createScene().addChild(doc.createNode().setMesh(mesh).setTranslation([2,0,0]));
 return new NodeIO().writeBinary(doc);
}
test('GLB extraction retains node placement and material; unsupported appearance fails explicitly',async()=>{
 const parts=await glbParts(await fixture());expect(parts).toHaveLength(1);expect(parts[0].positions[0]).toBe(2);expect(parts[0].surface.color).toEqual([.2,.3,.4,1]);
 await expect(glbParts(await fixture(true))).rejects.toThrow('UNSUPPORTED_VR_MATERIAL');
});
