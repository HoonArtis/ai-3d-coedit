import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
export interface ObjectStore{put(bytes:Uint8Array):Promise<string>;get(key:string):Promise<Uint8Array>;}
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
/** Immutable content-addressed local adapter; replace through ObjectStore for cloud hosting. */
export class LocalObjectStore implements ObjectStore{
  private directory:string;
  constructor(directory:string){this.directory=resolve(directory);}
  private path(key:string){if(!/^[a-f0-9]{64}$/.test(key))throw Error('INVALID_OBJECT_KEY');return join(this.directory,key);}
  async put(bytes:Uint8Array){
    const key=digest(bytes);await mkdir(this.directory,{recursive:true});
    try{await writeFile(this.path(key),bytes,{flag:'wx'});}catch(error){
      if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
      await this.get(key);
    }
    return key;
  }
  async get(key:string){const bytes=await readFile(this.path(key));if(digest(bytes)!==key)throw Error('CORRUPT_OBJECT');return bytes;}
}
