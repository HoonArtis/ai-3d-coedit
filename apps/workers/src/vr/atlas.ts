import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {Document,NodeIO} from '@gltf-transform/core';
import {BUDGETS} from '@coedit/contracts';
import type {MeshPart,Surface} from './parts';
const SIZE=1024,CELL=256,GUTTER=4,INNER=CELL-2*GUTTER;
const linear=(n:number)=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4;
const srgb=(n:number)=>Math.round(255*Math.min(1,Math.max(0,n<=.0031308?12.92*n:1.055*n**(1/2.4)-.055)));
function surfaceKey(s:Surface){return createHash('sha256').update(JSON.stringify(s.color)).update(s.image??new Uint8Array()).digest('hex');}
async function tile(surface:Surface){
 const pixels=surface.image?await sharp(surface.image,{limitInputPixels:4096*4096}).resize(INNER,INNER,{fit:'fill'}).ensureAlpha().raw().toBuffer():Buffer.alloc(INNER*INNER*4,255);
 for(let i=0;i<pixels.length;i+=4){for(let c=0;c<3;c++)pixels[i+c]=srgb(linear(pixels[i+c]/255)*surface.color[c]);pixels[i+3]=Math.round(pixels[i+3]*surface.color[3]);}
 // Replicate edge texels rather than bleeding a neighbour into lower mip levels.
 return sharp(pixels,{raw:{width:INNER,height:INNER,channels:4}}).extend({top:GUTTER,bottom:GUTTER,left:GUTTER,right:GUTTER,extendWith:'copy'}).png().toBuffer();
}
/** Static atlas groups preserve PBR factors; blended surfaces require sorted independent draws. */
export async function mergeAtlas(parts:MeshPart[]){
 if(!parts.length)throw Error('EMPTY_MESH');
 const groups=new Map<string,MeshPart[]>(),objects=new Set<string>();
 for(const part of parts){
  if(!part.objectId)throw Error('MISSING_OBJECT_ID');objects.add(part.objectId);
  const s=part.surface;if(s.alphaMode==='BLEND')throw Error('UNSUPPORTED_VR_TRANSPARENCY');
  const key=JSON.stringify([s.roughness,s.metalness,s.alphaMode,s.alphaCutoff,s.doubleSided]);
  const list=groups.get(key)??[];list.push(part);groups.set(key,list);
 }
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(),mesh=doc.createMesh();scene.addChild(doc.createNode().setMesh(mesh));
 let draws=0;
 for(const members of groups.values()){
  const surfaces=new Map<string,Surface>();for(const part of members)surfaces.set(surfaceKey(part.surface),part.surface);
  const entries=[...surfaces.entries()];
  for(let start=0;start<entries.length;start+=16){
   if(++draws>BUDGETS.vrDrawCalls)throw Error('VR_DRAW_BUDGET_EXCEEDED');
   const batch=entries.slice(start,start+16),slots=new Map(batch.map(([key],index)=>[key,index]));
   const images=await Promise.all(batch.map(async([,s],index)=>({input:await tile(s),left:index%4*CELL,top:Math.floor(index/4)*CELL})));
   const image=await sharp({create:{width:SIZE,height:SIZE,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(images).png().toBuffer();
   const surface=batch[0][1],texture=doc.createTexture().setImage(image).setMimeType('image/png');
   const material=doc.createMaterial().setBaseColorTexture(texture).setRoughnessFactor(surface.roughness).setMetallicFactor(surface.metalness).setAlphaMode(surface.alphaMode).setAlphaCutoff(surface.alphaCutoff).setDoubleSided(surface.doubleSided);
   material.getBaseColorTextureInfo()!.setWrapS(33071).setWrapT(33071);
   const selected=members.filter(p=>slots.has(surfaceKey(p.surface))),vertexCount=selected.reduce((n,p)=>n+p.positions.length/3,0),indexCount=selected.reduce((n,p)=>n+p.indices.length,0);
   const positions=new Float32Array(vertexCount*3),normals=new Float32Array(vertexCount*3),uv=new Float32Array(vertexCount*2),indices=new Uint32Array(indexCount);
   let vertexOffset=0,indexOffset=0;
   for(const part of selected){
    const slot=slots.get(surfaceKey(part.surface))!;
    positions.set(part.positions,vertexOffset*3);normals.set(part.normals,vertexOffset*3);
    for(let i=0;i<part.positions.length/3;i++){
     const u=part.surface.image?Math.max(0,Math.min(1,part.uv[i*2])):.5,v=part.surface.image?Math.max(0,Math.min(1,part.uv[i*2+1])):.5;
     uv[(vertexOffset+i)*2]=(slot%4*CELL+GUTTER+.5+u*(INNER-1))/SIZE;
     uv[(vertexOffset+i)*2+1]=(Math.floor(slot/4)*CELL+GUTTER+.5+v*(INNER-1))/SIZE;
    }
    for(const index of part.indices)indices[indexOffset++]=index+vertexOffset;
    vertexOffset+=part.positions.length/3;
   }
   const accessor=(array:Float32Array<ArrayBuffer>|Uint32Array<ArrayBuffer>,type:'VEC3'|'VEC2'|'SCALAR')=>doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
   mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',accessor(positions,'VEC3')).setAttribute('NORMAL',accessor(normals,'VEC3')).setAttribute('TEXCOORD_0',accessor(uv,'VEC2')).setIndices(accessor(indices,'SCALAR')).setMaterial(material));
  }
 }
 return {bytes:await new NodeIO().writeBinary(doc),objects:[...objects].sort()};
}
