import {test,expect} from 'vitest';
import {Document,NodeIO} from '@gltf-transform/core';
import sharp from 'sharp';
import {verifyArtifact} from '../../apps/workers/src/optimization/verify';
import {compressGlbTextures} from '../../apps/workers/src/optimization/texture';
async function artifact(triangles:number,withTexture=false){
 const doc=new Document(),buffer=doc.createBuffer(),array=new Float32Array(triangles*9);for(let i=0;i<triangles;i++)array.set([0,0,0,1,0,0,0,1,0],i*9);
 const primitive=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(array).setBuffer(buffer));
 if(withTexture){
  const image=await sharp({create:{width:2048,height:2048,channels:3,background:'red'}}).png().toBuffer(),texture=doc.createTexture().setImage(image).setMimeType('image/png');
  primitive.setMaterial(doc.createMaterial().setBaseColorTexture(texture));
  primitive.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(new Float32Array(triangles*6)).setBuffer(buffer));
 }
 doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(primitive)));return new NodeIO().writeBinary(doc);
}
test('artifact gate measures actual GLB, rejects over-budget triangles and uncompressed texture',async()=>{
 const large=await artifact(5001);await expect(verifyArtifact(large,'desktop')).rejects.toThrow('TRIANGLE_BUDGET_EXCEEDED');
 const desktop=await artifact(5000);expect((await verifyArtifact(desktop,'desktop')).triangles).toBe(5000);await expect(verifyArtifact(desktop,'vr')).rejects.toThrow('TRIANGLE_BUDGET_EXCEEDED');
 const png=await artifact(1,true);await expect(verifyArtifact(png,'desktop')).rejects.toThrow('KTX2_REQUIRED');
 const compressed=await compressGlbTextures(png);expect((await verifyArtifact(compressed,'desktop')).textures[0].size).toEqual([1024,1024]);
},30000);
