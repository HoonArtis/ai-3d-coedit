import {test,expect} from 'vitest';
import {Document,NodeIO} from '@gltf-transform/core';
import {applyMaterialPreset} from '../../apps/workers/src/optimization/material';
test('explicit preset selection replaces all old materials with exactly one material',async()=>{
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene();
 for(let i=0;i<2;i++){
  const position=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,i,1,0,i,0,1,i])).setBuffer(buffer);
  scene.addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION',position).setMaterial(doc.createMaterial('old-'+i)))));
 }
 const input=await new NodeIO().writeBinary(doc);
 for(const preset of ['wood','metal','fabric'] as const){
  const output=await applyMaterialPreset(input,preset),parsed=await new NodeIO().readBinary(output);
  expect(parsed.getRoot().listMaterials()).toHaveLength(1);expect(parsed.getRoot().listMaterials()[0].getName()).toBe('preset-'+preset);
  expect(parsed.getRoot().listMaterials()[0].getMetallicFactor()).toBe(preset==='metal'?1:0);
 }
 await expect(applyMaterialPreset(input,'automatic-secret-fallback')).rejects.toThrow('PRESET_REQUIRED');
});
