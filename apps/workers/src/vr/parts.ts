import {BufferGeometry,BufferAttribute,Matrix4,Matrix3,Vector3,Quaternion,Euler,Mesh,MeshStandardMaterial} from 'three';
import type {AssetDefinition,SceneObject} from '@coedit/contracts';
import {buildBuiltinModel,disposeBuiltinModel} from '@coedit/geometry';
import {readGlb} from '../optimization/mesh';
export type Surface={color:[number,number,number,number];roughness:number;metalness:number;alphaMode:'OPAQUE'|'MASK'|'BLEND';alphaCutoff:number;doubleSided:boolean;image?:Uint8Array};
export type MeshPart={positions:Float32Array;normals:Float32Array;uv:Float32Array;indices:Uint32Array;surface:Surface;objectId?:string};
function extract(geometry:BufferGeometry,surface:Surface,matrix:Matrix4):MeshPart{
 const copy=geometry.clone();
 try{
  if(!copy.getAttribute('normal'))copy.computeVertexNormals();
  copy.applyMatrix4(matrix);
  const position=copy.getAttribute('position'),normal=copy.getAttribute('normal'),uv=copy.getAttribute('uv');
  const positions=new Float32Array(position.count*3),normals=new Float32Array(position.count*3),coords=new Float32Array(position.count*2);
  for(let i=0;i<position.count;i++){
   positions.set([position.getX(i),position.getY(i),position.getZ(i)],i*3);
   normals.set([normal.getX(i),normal.getY(i),normal.getZ(i)],i*3);
   if(uv)coords.set([uv.getX(i),uv.getY(i)],i*2);
  }
  if([...positions,...normals,...coords].some(n=>!Number.isFinite(n)))throw Error('INVALID_VR_GEOMETRY');
  if(surface.image&&(!uv||coords.some(n=>n<-.00001||n>1.00001)))throw Error('UNSUPPORTED_VR_UV');
  const indices=Uint32Array.from(copy.index?.array??Array.from({length:position.count},(_,i)=>i));
  if(!indices.length||indices.length%3||indices.some(i=>i>=position.count))throw Error('INVALID_VR_INDICES');
  if(matrix.determinant()<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  return {positions,normals,uv:coords,indices,surface};
 }finally{copy.dispose();}
}
export function builtinParts(asset:AssetDefinition):MeshPart[]{
 const model=buildBuiltinModel(asset),parts:MeshPart[]=[];model.updateMatrixWorld(true);
 try{model.traverse(node=>{
  if(!(node instanceof Mesh))return;
  const material=node.material as MeshStandardMaterial;
  const geometry=material.flatShading&&node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
  try{
   if(material.flatShading)geometry.computeVertexNormals();
   parts.push(extract(geometry,{color:[material.color.r,material.color.g,material.color.b,material.opacity],roughness:material.roughness,metalness:material.metalness,alphaMode:'OPAQUE',alphaCutoff:.5,doubleSided:false},node.matrixWorld));
  }finally{geometry.dispose();}
 });return parts;}finally{disposeBuiltinModel(model);}
}
export async function glbParts(bytes:Uint8Array):Promise<MeshPart[]>{
 const doc=await readGlb(bytes),root=doc.getRoot(),parts:MeshPart[]=[];
 if(root.listSkins().length||root.listAnimations().length)throw Error('ANIMATED_ASSET_REQUIRES_CHARACTER_PIPELINE');
 if(root.listScenes().length!==1)throw Error('ONE_SCENE_REQUIRED');
 root.listScenes()[0].traverse(node=>{
  for(const primitive of node.getMesh()?.listPrimitives()??[]){
   if(primitive.getMode()!==4||primitive.listTargets().length)throw Error('STATIC_TRIANGLES_REQUIRED');
   const material=primitive.getMaterial(),info=material?.getBaseColorTextureInfo(),texture=material?.getBaseColorTexture();
   if(material&&(material.listExtensions().length||material.getNormalTexture()||material.getOcclusionTexture()||material.getMetallicRoughnessTexture()||material.getEmissiveTexture()||material.getEmissiveFactor().some(n=>n!==0))||info&&(info.listExtensions().length||info.getTexCoord()!==0)||primitive.getAttribute('COLOR_0'))throw Error('UNSUPPORTED_VR_MATERIAL');
   if(texture&&!['image/png','image/jpeg'].includes(texture.getMimeType()))throw Error('UNSUPPORTED_VR_TEXTURE');
   const image=texture?.getImage()??undefined;if(texture&&!image)throw Error('MISSING_TEXTURE');
   const surface:Surface={color:material?.getBaseColorFactor()??[1,1,1,1],roughness:material?.getRoughnessFactor()??1,metalness:material?.getMetallicFactor()??1,alphaMode:material?.getAlphaMode()??'OPAQUE',alphaCutoff:material?.getAlphaCutoff()??.5,doubleSided:material?.getDoubleSided()??false,image};
   const geometry=new BufferGeometry();
   try{
    for(const [source,target,size] of [['POSITION','position',3],['NORMAL','normal',3],['TEXCOORD_0','uv',2]] as const){
     const accessor=primitive.getAttribute(source);if(!accessor){if(source==='POSITION')throw Error('INVALID_POSITIONS');continue;}
     if(accessor.getElementSize()!==size)throw Error('INVALID_VR_ATTRIBUTE');
     const values=new Float32Array(accessor.getCount()*size),element:number[]=[];
     for(let i=0;i<accessor.getCount();i++){accessor.getElement(i,element);values.set(element,i*size);}
     geometry.setAttribute(target,new BufferAttribute(values,size));
    }
    const index=primitive.getIndices();if(index)geometry.setIndex(new BufferAttribute(Uint32Array.from(index.getArray()!),1));
    parts.push(extract(geometry,surface,new Matrix4().fromArray(node.getWorldMatrix())));
   }finally{geometry.dispose();}
  }
 });
 if(!parts.length)throw Error('EMPTY_MESH');return parts;
}
export function placeParts(parts:MeshPart[],object:SceneObject):MeshPart[]{
 const matrix=new Matrix4().compose(new Vector3(...object.position),new Quaternion().setFromEuler(new Euler(...object.rotation)),new Vector3(...object.scale)),normalMatrix=new Matrix3().getNormalMatrix(matrix);
 return parts.map(part=>{
  const positions=part.positions.slice(),normals=part.normals.slice(),v=new Vector3();
  for(let i=0;i<positions.length;i+=3){v.fromArray(positions,i).applyMatrix4(matrix).toArray(positions,i);v.fromArray(normals,i).applyMatrix3(normalMatrix).normalize().toArray(normals,i);}
  return {...part,positions,normals,objectId:object.id};
 });
}
