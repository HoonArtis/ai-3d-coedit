import {NodeIO,type Document} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld,simplify,prune,dedup,center,getBounds} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import {BUDGETS} from '@coedit/contracts';
const io=()=>new NodeIO().registerExtensions(ALL_EXTENSIONS);
/** No external files/URLs: artifacts must be self-contained GLB. */
export async function readGlb(bytes:Uint8Array){
 if(bytes.length<20||bytes.length>64*1024*1024)throw Error('INVALID_GLB');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length||view.getUint32(16,true)!==0x4e4f534a)throw Error('INVALID_GLB');
 const length=view.getUint32(12,true);if(length>bytes.length-20)throw Error('INVALID_GLB');
 const json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length)));
 if([...(json.buffers??[]),...(json.images??[])].some((entry:{uri?:unknown})=>entry.uri!==undefined))throw Error('EXTERNAL_RESOURCE');
 return io().readBinary(bytes);
}
function inspect(doc:Document){
 const root=doc.getRoot(),scenes=root.listScenes();if(scenes.length!==1)throw Error('ONE_SCENE_REQUIRED');
 let triangles=0,drawCalls=0;
 scenes[0].traverse(node=>{
  if([...node.getWorldMatrix()].some(n=>!Number.isFinite(n)))throw Error('INVALID_TRANSFORM');
  for(const primitive of node.getMesh()?.listPrimitives()??[]){
   if(primitive.getMode()!==4)throw Error('TRIANGLES_REQUIRED');
   const positions=primitive.getAttribute('POSITION');if(!positions||positions.getType()!=='VEC3')throw Error('INVALID_POSITIONS');
   const array=positions.getArray();if(!array||Array.from(array).some(n=>!Number.isFinite(n)))throw Error('INVALID_POSITIONS');
   const index=primitive.getIndices();if(index&&Array.from(index.getArray()!).some(n=>!Number.isInteger(n)||n<0||n>=positions.getCount()))throw Error('INVALID_INDICES');
   const count=index?.getCount()??positions.getCount();if(count%3)throw Error('INVALID_INDICES');
   triangles+=count/3;drawCalls++;
  }
 });
 if(!triangles)throw Error('EMPTY_MESH');
 const bounds=getBounds(scenes[0]),dimensions=bounds.max.map((n,i)=>n-bounds.min[i]);
 if(dimensions.some(n=>!Number.isFinite(n))||dimensions.filter(n=>n>1e-6).length<2)throw Error('DEGENERATE_MESH');
 return {triangles,drawCalls,materials:root.listMaterials().length,textures:root.listTextures().map(t=>({mimeType:t.getMimeType(),size:t.getSize()})),bounds,dimensions};
}
export async function inspectGlb(bytes:Uint8Array){return inspect(await readGlb(bytes));}
export async function optimizeStaticGlb(bytes:Uint8Array,target:'desktop'|'vr'){
 const doc=await readGlb(bytes),before=inspect(doc),root=doc.getRoot();
 if(root.listSkins().length||root.listAnimations().length||root.listMeshes().some(m=>m.listPrimitives().some(p=>p.listTargets().length)))throw Error('ANIMATED_ASSET_REQUIRES_CHARACTER_PIPELINE');
 const limit=target==='desktop'?BUDGETS.desktopAssetTriangles:BUDGETS.vrAssetTriangles;
 await MeshoptSimplifier.ready;
 await doc.transform(weld(),dedup());
 if(before.triangles>limit)await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:(limit*.98)/before.triangles,error:1,lockBorder:false}));
 await doc.transform(prune(),center({pivot:'below'}));
 const stats=inspect(doc);
 if(stats.triangles>limit)throw Error('TRIANGLE_BUDGET_EXCEEDED');
 // Guard collapse or explosions. A visual review still determines fidelity.
 if(stats.dimensions.some((n,i)=>n>before.dimensions[i]*1.2+1e-4||before.dimensions[i]>1e-4&&n<before.dimensions[i]*.5))throw Error('SHAPE_COLLAPSED');
 const output=await io().writeBinary(doc);return {bytes:output,stats,before};
}
