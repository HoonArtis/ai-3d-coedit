import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve,join,dirname,basename} from 'node:path';import {randomUUID} from 'node:crypto';
import {cloneDocument} from '@gltf-transform/functions';
import {NodeIO} from '@gltf-transform/core';
import {Box3,Vector3,SkinnedMesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {runWorkerProcess} from '@coedit/jobs';
import {readGlb,inspectGlb} from '../optimization/mesh';
import {validateCharacterUpload} from '@coedit/contracts';
export {validateCharacterUpload} from '@coedit/contracts';
export async function inspectCharacterGlb(bytes:Uint8Array,limit:number){
 const doc=await readGlb(bytes),root=doc.getRoot(),skins=root.listSkins(),scenes=root.listScenes();
 if(!skins.length||skins.length>4||scenes.length!==1)throw Error('CHARACTER_RIG_REQUIRED');
 const joints=new Set(skins.flatMap(s=>s.listJoints()));if(!joints.size||joints.size>128)throw Error('CHARACTER_RIG_LIMIT');
 let triangles=0,drawCalls=0;
 for(const accessor of root.listAccessors()){const a=accessor.getArray();if(!a||Array.from(a).some(n=>!Number.isFinite(n)))throw Error('CHARACTER_INVALID_ACCESSOR');}
 for(const skin of skins){const inverse=skin.getInverseBindMatrices();if(!inverse||inverse.getCount()!==skin.listJoints().length)throw Error('CHARACTER_INVALID_BIND');}
 for(const node of root.listNodes()){
  const mesh=node.getMesh();if(!mesh)continue;const skin=node.getSkin();if(!skin)throw Error('CHARACTER_UNBOUND_MESH');
  for(const primitive of mesh.listPrimitives()){
   if(primitive.getMode()!==4)throw Error('CHARACTER_PRIMITIVE');
   const pos=primitive.getAttribute('POSITION'),weights=primitive.getAttribute('WEIGHTS_0'),indices=primitive.getAttribute('JOINTS_0');
   if(!pos||!weights||!indices||weights.getCount()!==pos.getCount()||indices.getCount()!==pos.getCount())throw Error('CHARACTER_INVALID_SKIN');
   const w:number[]=[],j:number[]=[];for(let i=0;i<pos.getCount();i++){weights.getElement(i,w);indices.getElement(i,j);if(w.some(x=>x<0)||Math.abs(w.reduce((a,b)=>a+b,0)-1)>.02||j.some(x=>!Number.isInteger(x)||x<0||x>=skin.listJoints().length))throw Error('CHARACTER_INVALID_SKIN');}
   const count=primitive.getIndices()?.getCount()??pos.getCount();if(count%3)throw Error('CHARACTER_PRIMITIVE');triangles+=count/3;drawCalls++;
   const faces=primitive.getIndices()?.getArray();if(faces&&Array.from(faces).some(i=>i>=pos.getCount()))throw Error('CHARACTER_INVALID_INDEX');
  }
 }
 if(!triangles||triangles>limit||drawCalls>16)throw Error('CHARACTER_BUDGET');
 for(const animation of root.listAnimations()){
  if(!animation.listChannels().length)throw Error('CHARACTER_INVALID_ANIMATION');
  for(const channel of animation.listChannels()){
   const sampler=channel.getSampler(),input=sampler?.getInput(),output=sampler?.getOutput();
   if(!channel.getTargetNode()||!input||!output||!input.getCount()||output.getCount()!==input.getCount()*(sampler!.getInterpolation()==='CUBICSPLINE'?3:1))throw Error('CHARACTER_INVALID_ANIMATION');
   const times=Array.from(input.getArray()!);if(times.some((n,i)=>n<0||i>0&&n<=times[i-1]))throw Error('CHARACTER_INVALID_ANIMATION');
  }
 }
 // Static glTF bounds ignore inverse bind matrices; measure actual posed vertices.
 const geometryDoc=cloneDocument(doc);for(const texture of geometryDoc.getRoot().listTextures())texture.dispose();for(const extension of geometryDoc.getRoot().listExtensionsUsed())extension.dispose();
 const geometryBytes=await new NodeIO().writeBinary(geometryDoc),loaded=await new GLTFLoader().parseAsync(geometryBytes.buffer.slice(geometryBytes.byteOffset,geometryBytes.byteOffset+geometryBytes.byteLength) as ArrayBuffer,'');
 loaded.scene.updateMatrixWorld(true);loaded.scene.traverse(o=>{if(o instanceof SkinnedMesh)o.skeleton.update();});
 const dimensions=new Box3().setFromObject(loaded.scene,true).getSize(new Vector3()).toArray();
 if(dimensions.some(v=>!Number.isFinite(v)||v<0||v>5)||Math.abs(dimensions[1]-1.7)>.17)throw Error('CHARACTER_BOUNDS');
 return {triangles,drawCalls,dimensions,joints:joints.size,clips:root.listAnimations().map((a,i)=>a.getName()||'clip-'+i)};
}
export async function convertCharacter(bytes:Uint8Array,rawFormat:unknown){
 const format=validateCharacterUpload(bytes,rawFormat);if(format==='glb')await readGlb(bytes);
 const parent=resolve(tmpdir()),directory=await mkdtemp(join(parent,'coedit-character-')),container='coedit-character-'+randomUUID();
 try{
  const input=join(directory,'input'),output=join(directory,'output');await mkdir(input);await mkdir(output);await writeFile(join(input,'source.'+format),bytes);
  await runWorkerProcess('docker',['run','--rm','--name',container,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','65534:65534','--cpus','2','--memory','4g','--pids-limit','128','--tmpfs','/tmp:rw,nosuid,size=256m','--env','HOME=/tmp','--mount',`type=bind,source=${input},target=/input,readonly`,'--mount',`type=bind,source=${output},target=/output`,'--mount',`type=bind,source=${resolve('workers/characters/convert.py')},target=/convert.py,readonly`,'coedit-character:5.1.2','--python','/convert.py','--','/input/source.'+format],{timeoutMs:180000});
  const desktop=await readFile(join(output,'desktop.glb')),avatar=await readFile(join(output,'avatar.glb')),vr=await readFile(join(output,'vr.glb'));
  const vrDoc=await readGlb(vr);if(vrDoc.getRoot().listSkins().length||vrDoc.getRoot().listAnimations().length)throw Error('CHARACTER_STATIC_VR');
  return {desktop:{bytes:desktop,stats:await inspectCharacterGlb(desktop,5000)},avatar:{bytes:avatar,stats:await inspectCharacterGlb(avatar,10000)},vr:{bytes:vr,stats:await inspectGlb(vr)}};
 }finally{
  await runWorkerProcess('docker',['rm','-f',container],{timeoutMs:30000}).catch(()=>{});
  if(dirname(resolve(directory))!==parent||!basename(directory).startsWith('coedit-character-'))throw Error('UNSAFE_TEMP_PATH');await rm(directory,{recursive:true,force:true});
 }
}
