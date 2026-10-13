import {createHash} from 'node:crypto';
/** Stable across delivery retries, different for a user's redraw version. */
export const generationSeed=(jobId:string,version:number)=>createHash('sha256').update(JSON.stringify([jobId,version])).digest().readUInt32LE(0)&0x7fffffff;
