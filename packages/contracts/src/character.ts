import {z} from 'zod';
import {objectKeySchema} from './primitives';
export const characterSourceSchema=z.object({kind:z.literal('character'),format:z.enum(['fbx','glb']),name:z.string().trim().min(1).max(80),inputKey:objectKeySchema}).strict();
export const characterDeliverySchema=z.object({avatarKey:objectKeySchema,vrKey:objectKeySchema,joints:z.number().int().min(1).max(128),clips:z.array(z.string().max(200)).max(32),avatarTriangles:z.number().int().min(1).max(10000)}).strict();
export function validateCharacterUpload(bytes:Uint8Array,format:unknown){
 if(!bytes.length||bytes.length>64*1024*1024)throw Error('CHARACTER_SIZE');
 if(format!=='fbx'&&format!=='glb')throw Error('CHARACTER_FORMAT');
 const signature=new Uint8Array([75,97,121,100,97,114,97,32,70,66,88,32,66,105,110,97,114,121,32,32,0,26,0]);
 if(format==='fbx'&&(bytes.length<27||signature.some((v,i)=>bytes[i]!==v)))throw Error('CHARACTER_FORMAT');
 if(format==='glb'){if(bytes.length<20)throw Error('CHARACTER_FORMAT');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length)throw Error('CHARACTER_FORMAT');}
 return format;
}
