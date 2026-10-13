import {Group,Mesh,BoxGeometry,CylinderGeometry,IcosahedronGeometry,MeshStandardMaterial,type BufferGeometry} from 'three';
import type {AssetDefinition,Vec3} from '@coedit/contracts';
/** The same procedural geometry is rendered by the editor and exported by the VR worker. */
export function buildBuiltinModel(asset:AssetDefinition):Group{
  if(asset.kind==='generated')throw Error('BUILTIN_REQUIRED');
  const group=new Group();
  const mesh=(geometry:BufferGeometry,position:Vec3,color=asset.color,roughness=1,flatShading=false,scale:Vec3=[1,1,1])=>{
    const object=new Mesh(geometry,new MeshStandardMaterial({color,roughness,flatShading}));object.position.set(...position);object.scale.set(...scale);object.castShadow=true;object.receiveShadow=true;group.add(object);
  };
  const box=(position:Vec3,size:Vec3,color=asset.color)=>mesh(new BoxGeometry(...size),position,color,.85);
  if(asset.kind==='chair'){
    box([0,.52,0],[.8,.14,.8]);box([0,.84,-.34],[.8,.42,.12]);
    for(const x of [-.28,.28])for(const z of [-.28,.28])box([x,.25,z],[.09,.5,.09],'#68655c');
  }else if(asset.kind==='table'){
    mesh(new CylinderGeometry(.9,.9,.12,40),[0,.79,0]);box([0,.36,0],[.2,.72,.2],'#797b6b');box([0,.04,0],[.8,.08,.8],'#797b6b');
  }else if(asset.kind==='tree'){
    mesh(new CylinderGeometry(.12,.18,1.3,10),[0,.65,0],'#a38466');mesh(new IcosahedronGeometry(.95,2),[0,1.85,0],asset.color,1,true);
  }else if(asset.kind==='plant'){
    mesh(new CylinderGeometry(.28,.2,.4,24),[0,.2,0],'#c99071');mesh(new IcosahedronGeometry(1,1),[0,.65,0],asset.color,1,false,[.32,.43,.32]);
  }else if(asset.kind==='bench'){
    box([0,.48,0],[2,.14,.7]);box([0,.8,-.29],[2,.3,.12]);for(const x of [-.7,.7])box([x,.22,0],[.12,.44,.55],'#666d64');
  }else box([0,.5,0],[1,1,1]);
  return group;
}
export function disposeBuiltinModel(group:Group){
  group.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});
}
