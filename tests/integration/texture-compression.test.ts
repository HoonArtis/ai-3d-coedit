import {test,expect} from 'vitest';
import sharp from 'sharp';
import {Document,NodeIO} from '@gltf-transform/core';
import {KHRTextureBasisu} from '@gltf-transform/extensions';
import {compressKtx2,inspectKtx2,compressGlbTextures} from '../../apps/workers/src/optimization/texture';
test('real KTX tool creates 1024 Basis texture with full mip chain and bounded size',async()=>{
 const input=await sharp({create:{width:2048,height:2048,channels:4,background:'#4080a0'}}).png().toBuffer();
 const result=await compressKtx2(input,true);expect(inspectKtx2(result)).toMatchObject({width:1024,height:1024,levels:11});
 expect(result.length).toBeLessThan(1024*1024*2);
 const uncompressed=Buffer.from(result);uncompressed.writeUInt32LE(43,12);uncompressed.writeUInt32LE(0,44);expect(()=>inspectKtx2(uncompressed)).toThrow('INVALID_KTX2');
 await expect(compressKtx2(Buffer.from('broken'),true)).rejects.toThrow();
 expect(()=>inspectKtx2(Buffer.alloc(100))).toThrow('INVALID_KTX2');
},30000);
test('compressed GLB keeps UVs and declares the required Basis texture extension',async()=>{
 const doc=new Document(),buffer=doc.createBuffer();
 const position=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0])).setBuffer(buffer);
 const uv=doc.createAccessor().setType('VEC2').setArray(new Float32Array([0,0,1,0,0,1])).setBuffer(buffer);
 const image=await sharp({create:{width:1024,height:1024,channels:3,background:'#aa7755'}}).png().toBuffer();
 const texture=doc.createTexture().setImage(image).setMimeType('image/png'),material=doc.createMaterial().setBaseColorTexture(texture);
 const primitive=doc.createPrimitive().setAttribute('POSITION',position).setAttribute('TEXCOORD_0',uv).setMaterial(material);
 doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(primitive)));
 const output=await compressGlbTextures(await new NodeIO().writeBinary(doc));
 const parsed=await new NodeIO().registerExtensions([KHRTextureBasisu]).readBinary(output);
 expect(parsed.getRoot().listExtensionsRequired().map(e=>e.extensionName)).toContain('KHR_texture_basisu');
 const t=parsed.getRoot().listTextures()[0];expect(t.getMimeType()).toBe('image/ktx2');expect(inspectKtx2(t.getImage()!)).toMatchObject({width:1024,height:1024});
 expect(Array.from(parsed.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('TEXCOORD_0')!.getArray()!)).toEqual([0,0,1,0,0,1]);
},30000);
