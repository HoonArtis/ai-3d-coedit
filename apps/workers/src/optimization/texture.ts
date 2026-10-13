import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname,basename} from 'node:path';
import sharp from 'sharp';
import {BUDGETS} from '@coedit/contracts';
import {runWorkerProcess} from '@coedit/jobs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,KHRTextureBasisu} from '@gltf-transform/extensions';
import {getTextureColorSpace} from '@gltf-transform/functions';
import {readGlb} from './mesh';
const signature=Buffer.from([0xab,0x4b,0x54,0x58,0x20,0x32,0x30,0xbb,0x0d,0x0a,0x1a,0x0a]);
export function inspectKtx2(bytes:Uint8Array){
 const b=Buffer.from(bytes);if(b.length<80||!b.subarray(0,12).equals(signature))throw Error('INVALID_KTX2');
 const width=b.readUInt32LE(20),height=b.readUInt32LE(24),levels=b.readUInt32LE(40);
 if(b.readUInt32LE(12)!==0||b.readUInt32LE(44)!==1||!width||!height||width>BUDGETS.textureSize||height>BUDGETS.textureSize||b.readUInt32LE(28)!==0||b.readUInt32LE(36)!==1||levels!==Math.floor(Math.log2(Math.max(width,height)))+1||b.length<80+levels*24)throw Error('INVALID_KTX2');
 for(let i=0;i<levels;i++){const offset=b.readBigUInt64LE(80+i*24),length=b.readBigUInt64LE(88+i*24);if(!length||offset+length>BigInt(b.length))throw Error('INVALID_KTX2');}
 return {width,height,levels,bytes:bytes.length};
}
export async function compressKtx2(bytes:Uint8Array,srgb:boolean){
 if(bytes.length>64*1024*1024)throw Error('TEXTURE_SIZE');
 const image=sharp(bytes,{failOn:'warning',limitInputPixels:4096*4096}),meta=await image.metadata();
 if(!meta.width||!meta.height||!['png','jpeg','webp'].includes(meta.format??''))throw Error('TEXTURE_FORMAT');
 const png=await image.resize(BUDGETS.textureSize,BUDGETS.textureSize,{fit:'fill'}).png().toBuffer();
 const parent=resolve(tmpdir()),directory=await mkdtemp(join(parent,'coedit-ktx-'));
 try{
  const input=join(directory,'source.png'),output=join(directory,'texture.ktx2');await writeFile(input,png);
  const encoder=resolve(process.env.TOKTX_PATH??'.cache/ktx/bin/toktx.exe');
  await runWorkerProcess(encoder,['--t2','--encode','etc1s','--genmipmap','--assign_oetf',srgb?'srgb':'linear','--assign_primaries','bt709','--threads','2',output,input],{timeoutMs:120000});
  const result=await readFile(output);inspectKtx2(result);return result;
 }finally{
  if(dirname(resolve(directory))!==parent||!basename(directory).startsWith('coedit-ktx-'))throw Error('UNSAFE_TEMP_PATH');
  await rm(directory,{recursive:true,force:true});
 }
}
export async function compressGlbTextures(bytes:Uint8Array){
 const doc=await readGlb(bytes),textures=doc.getRoot().listTextures();
 for(const texture of textures){
  const image=texture.getImage();if(!image)throw Error('MISSING_TEXTURE');
  if(texture.getMimeType()==='image/ktx2'){inspectKtx2(image);continue;}
  const output=await compressKtx2(image,getTextureColorSpace(texture)==='srgb');texture.setImage(output).setMimeType('image/ktx2');
 }
 if(textures.length)doc.createExtension(KHRTextureBasisu).setRequired(true);
 return new NodeIO().registerExtensions(ALL_EXTENSIONS).writeBinary(doc);
}
