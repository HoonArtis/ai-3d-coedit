import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Pool,PoolClient} from 'pg';
import {generationRequestSchema,objectKeySchema,retexturePreparedSchema,type RetexturePrepared,type GenerationRecord,type Session} from '@coedit/contracts';
import {validateGenerationPrompt} from './prompt-filter';
type Scope=Session&{roomKey:string};
const select=`SELECT j.id,j.actor,j.room_id AS "roomId",j.generation,v.version,v.state,v.source,v.image_key AS "imageKey",v.shape_key AS "shapeKey",v.error,v.target FROM coedit_generation_jobs j JOIN coedit_generation_versions v ON v.job_id=j.id AND v.version=j.current_version`;
export class GenerationRepository{
 constructor(private pool:Pool){}
 async migrate(){for(const name of ['003-generation.sql','008-retexture.sql'])await this.pool.query(await readFile(new URL('../../../../infra/migrations/'+name,import.meta.url),'utf8'));}
 private async membership(db:Pool|PoolClient,scope:Scope,lock=false){
  if(scope.role!=='student')throw Error('FORBIDDEN');
  const row=(await db.query(`SELECT c.id,c.generation_limit FROM coedit_students s JOIN coedit_class_rooms r ON r.id=s.room_id JOIN coedit_classes c ON c.id=r.class_id WHERE s.id=$1 AND r.id=$2${lock?' FOR UPDATE OF c':''}`,[scope.actor,scope.roomKey])).rows[0];
  if(!row)throw Error('FORBIDDEN');return row as {id:string;generation_limit:number};
 }
 async usage(scope:Scope){const c=await this.membership(this.pool,scope);return {used:await this.used(this.pool,scope.actor,c.id),limit:c.generation_limit};}
 private async used(db:Pool|PoolClient,actor:string,classId:string):Promise<number>{return (await db.query('SELECT count(*)::int AS n FROM coedit_generation_versions v JOIN coedit_generation_jobs j ON j.id=v.job_id WHERE j.actor=$1 AND j.class_id=$2 AND v.charged',[actor,classId])).rows[0].n;}
 async get(scope:Scope,id:string):Promise<GenerationRecord>{
  await this.membership(this.pool,scope);
  const row=(await this.pool.query(select+' WHERE j.id=$1 AND j.actor=$2 AND j.room_id=$3',[id,scope.actor,scope.roomKey])).rows[0];
  if(!row)throw Error('FORBIDDEN');return row;
 }
 async list(scope:Scope):Promise<GenerationRecord[]>{await this.membership(this.pool,scope);return (await this.pool.query(select+' WHERE j.actor=$1 AND j.room_id=$2 ORDER BY v.created_at DESC LIMIT 100',[scope.actor,scope.roomKey])).rows;}
 async reserve(scope:Scope,generation:number,raw:unknown,publish?:()=>Promise<void>):Promise<GenerationRecord>{return this.reserveInput(scope,generation,raw,undefined,publish);}
 async reserveRetexture(scope:Scope,generation:number,raw:unknown,prepared:RetexturePrepared):Promise<GenerationRecord>{return this.reserveInput(scope,generation,raw,retexturePreparedSchema.parse(prepared));}
 private async reserveInput(scope:Scope,generation:number,raw:unknown,prepared?:RetexturePrepared,publish?:()=>Promise<void>):Promise<GenerationRecord>{
  const input=generationRequestSchema.parse(raw);
  if(prepared&&(input.jobId||input.source.kind!=='text'||prepared.target.generation!==generation))throw Error('INVALID_RETEXTURE');
  const fingerprint=prepared?{...input,prepared}:input;
  if(input.source.kind==='text')validateGenerationPrompt(input.source.prompt);
  if(!Number.isSafeInteger(generation)||generation<0)throw Error('INVALID_GENERATION');
  const db=await this.pool.connect();
  try{
   await db.query('BEGIN');const c=await this.membership(db,scope,true);
   const existing=(await db.query('SELECT v.job_id,v.version,v.input=$3::jsonb AS same,j.room_id FROM coedit_generation_versions v JOIN coedit_generation_jobs j ON j.id=v.job_id WHERE v.actor=$1 AND v.request_id=$2',[scope.actor,input.requestId,fingerprint])).rows[0];
   if(existing){
    if(!existing.same||existing.room_id!==scope.roomKey)throw Error('REQUEST_CONFLICT');
    const row=(await db.query(select+' WHERE j.id=$1',[existing.job_id])).rows[0];await db.query('COMMIT');return row;
   }
   let id=input.jobId??randomUUID(),version=1;
   if(input.jobId){
    const old=(await db.query(select+' WHERE j.id=$1 AND j.actor=$2 AND j.room_id=$3 FOR UPDATE OF j',[id,scope.actor,scope.roomKey])).rows[0];
    if(!old)throw Error('FORBIDDEN');
    if(old.version!==input.expectedVersion)throw Error('STALE_IMAGE');
    if(old.state!=='awaiting_confirmation'&&old.state!=='failed')throw Error('ALREADY_CONFIRMED');
    if(old.target)prepared=retexturePreparedSchema.parse({shapeKey:old.shapeKey,target:old.target});
    version=old.version+1;
   }
   if(await this.used(db,scope.actor,c.id)>=c.generation_limit)throw Error('GENERATION_LIMIT');
   if(input.jobId)await db.query('UPDATE coedit_generation_jobs SET current_version=$2,generation=$3 WHERE id=$1',[id,version,generation]);
   else await db.query('INSERT INTO coedit_generation_jobs(id,actor,room_id,class_id,generation,current_version) VALUES($1,$2,$3,$4,$5,1)',[id,scope.actor,scope.roomKey,c.id,generation]);
   const uploaded=input.source.kind==='upload';
   await db.query('INSERT INTO coedit_generation_versions(job_id,version,actor,request_id,input,source,state,image_key,shape_key,target) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,version,scope.actor,input.requestId,fingerprint,input.source,prepared||input.source.kind==='character'?'shape_ready':uploaded?'awaiting_confirmation':'image_queued',prepared?.imageKey??(input.source.kind==='upload'?input.source.imageKey:null),prepared?.shapeKey??(input.source.kind==='character'?input.source.inputKey:null),prepared?.target??null]);
   const row=(await db.query(select+' WHERE j.id=$1',[id])).rows[0];await publish?.();await db.query('COMMIT');return row;
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 async imageReady(id:string,version:number,key:string){objectKeySchema.parse(key);await this.pool.query("UPDATE coedit_generation_versions v SET state='awaiting_confirmation',image_key=$3 FROM coedit_generation_jobs j WHERE j.id=v.job_id AND j.current_version=v.version AND v.job_id=$1 AND v.version=$2 AND v.state='image_queued'",[id,version,key]);}
 async confirm(scope:Scope,id:string,version:number):Promise<GenerationRecord>{
  const db=await this.pool.connect();try{
   await db.query('BEGIN');await this.membership(db,scope,true);
   const row=(await db.query(select+' WHERE j.id=$1 AND j.actor=$2 AND j.room_id=$3 FOR UPDATE OF j',[id,scope.actor,scope.roomKey])).rows[0];
   if(!row)throw Error('FORBIDDEN');if(row.version!==version)throw Error('STALE_IMAGE');
   if(!['awaiting_confirmation','shape_queued','shape_ready'].includes(row.state))throw Error('IMAGE_NOT_READY');
   if(row.state==='awaiting_confirmation')await db.query("UPDATE coedit_generation_versions SET state=$3 WHERE job_id=$1 AND version=$2",[id,version,row.target&&row.shapeKey?'shape_ready':'shape_queued']);
   const result=(await db.query(select+' WHERE j.id=$1',[id])).rows[0];await db.query('COMMIT');return result;
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 async fail(id:string,version:number,error:string){await this.pool.query("UPDATE coedit_generation_versions SET state='failed',error=$3,charged=false WHERE job_id=$1 AND version=$2 AND state IN ('image_queued','shape_queued')",[id,version,error.slice(0,120)]);}
 async shapeReady(id:string,version:number,key:string){objectKeySchema.parse(key);await this.pool.query("UPDATE coedit_generation_versions SET state='shape_ready',shape_key=$3 WHERE job_id=$1 AND version=$2 AND state='shape_queued'",[id,version,key]);}
 async pending():Promise<GenerationRecord[]>{return (await this.pool.query(select+" WHERE v.state IN ('image_queued','shape_queued') ORDER BY v.created_at LIMIT 100")).rows;}
}
