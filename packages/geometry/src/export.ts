import {Document,NodeIO} from '@gltf-transform/core';
import {Mesh,type MeshStandardMaterial} from 'three';
import type {AssetDefinition} from '@coedit/contracts';
import {buildBuiltinModel,disposeBuiltinModel} from './index';
/** Export from the same model factory as the editor; no renderer or browser is required. */
export async function exportBuiltinGlb(asset:AssetDefinition){
 const group=buildBuiltinModel(asset),doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene();
 try{
  group.traverse(object=>{
   if(!(object instanceof Mesh))return;
   const material=object.material as MeshStandardMaterial,geometry=material.flatShading&&object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
   try{
    if(material.flatShading)geometry.computeVertexNormals();
    const primitive=doc.createPrimitive().setMaterial(doc.createMaterial().setBaseColorFactor([material.color.r,material.color.g,material.color.b,material.opacity]).setRoughnessFactor(material.roughness).setMetallicFactor(material.metalness));
    for(const [name,semantic,type] of [['position','POSITION','VEC3'],['normal','NORMAL','VEC3'],['uv','TEXCOORD_0','VEC2']] as const){const attribute=geometry.getAttribute(name);if(attribute)primitive.setAttribute(semantic,doc.createAccessor().setType(type).setArray(new Float32Array(attribute.array)).setBuffer(buffer));}
    if(geometry.index)primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(geometry.index.array)).setBuffer(buffer));
    scene.addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(primitive)).setTranslation(object.position.toArray()).setRotation(object.quaternion.toArray()).setScale(object.scale.toArray()));
   }finally{geometry.dispose();}
  });return await new NodeIO().writeBinary(doc);
 }finally{disposeBuiltinModel(group);}
}
