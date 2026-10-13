import {test,expect} from 'vitest';
import sharp from 'sharp';
import {BUILTIN_LIBRARY,type SceneObject} from '@coedit/contracts';
import {builtinParts,placeParts} from '../../apps/workers/src/vr/parts';
import {mergeAtlas} from '../../apps/workers/src/vr/atlas';
import {readGlb,inspectGlb} from '../../apps/workers/src/optimization/mesh';
test('200 placed objects merge into bounded draws with complete coverage and 1024 atlas',async()=>{
 const parts=Array.from({length:200},(_,i)=>placeParts(builtinParts(BUILTIN_LIBRARY.cube),{id:`object-${i}`,assetId:'cube',owner:'student',name:'cube',position:[i%20,0,Math.floor(i/20)],rotation:[0,0,0],scale:[1,1,1],revision:1,lastActor:'student'} satisfies SceneObject)).flat();
 const result=await mergeAtlas(parts),stats=await inspectGlb(result.bytes);
 expect(stats.triangles).toBe(2400);expect(stats.drawCalls).toBe(1);expect(result.objects).toHaveLength(200);expect(stats.textures[0].size).toEqual([1024,1024]);
 const doc=await readGlb(result.bytes),uv=doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('TEXCOORD_0')!.getArray()!;
 expect(Math.min(...uv)).toBeGreaterThan(0);expect(Math.max(...uv)).toBeLessThan(.25);
});
test('atlas multiplies linear material color into sRGB pixels and retains roughness groups',async()=>{
 const first=builtinParts(BUILTIN_LIBRARY.cube)[0];first.objectId='one';first.surface={...first.surface,color:[.25,1,1,1],image:await sharp({create:{width:2,height:2,channels:4,background:'#ffffff'}}).png().toBuffer()};
 const second={...first,objectId:'two',surface:{...first.surface,roughness:.1}};
 const result=await mergeAtlas([first,second]),doc=await readGlb(result.bytes);
 expect(doc.getRoot().listMaterials()).toHaveLength(2);
 const pixel=await sharp(doc.getRoot().listTextures()[0].getImage()!).extract({left:20,top:20,width:1,height:1}).raw().toBuffer();
 expect(pixel[0]).toBeCloseTo(137,0);expect(pixel[1]).toBe(255);
 await expect(mergeAtlas([{...first,surface:{...first.surface,alphaMode:'BLEND'}}])).rejects.toThrow('UNSUPPORTED_VR_TRANSPARENCY');
});
