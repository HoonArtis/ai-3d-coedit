import {readFile} from 'node:fs/promises';
import type {Pool} from 'pg';
import {materialPresetSchema,objectKeySchema,type FinishingRecord,type Session,type RetexturePrepared} from '@coedit/contracts';
type Scope=Session&{roomKey:string};
const columns=`f.job_id AS "jobId",f.version,f.phase,f.preset,f.texture_key AS "textureKey",f.artifact_id AS "artifactId",f.error,f.stale_scene AS "staleScene"`;
const select=`SELECT ${columns} FROM coedit_generation_finishing f JOIN coedit_generation_jobs j ON j.id=f.job_id`;
export type PendingFinish=FinishingRecord&{actor:string;roomId:string;generation:number;imageKey:string|null;shapeKey:string;target:RetexturePrepared['target']|null;source:{kind:string;prompt?:string;inputKey?:string;format?:string;name?:string}};
export class FinishingRepository{
 constructor(private pool:Pool){}
 async migrate(){await this.pool.query(await readFile(new URL('../../../../infra/migrations/004-finishing.sql',import.meta.url),'utf8'));}
 async discover(){await this.pool.query("INSERT INTO coedit_generation_finishing(job_id,version,phase) SELECT v.job_id,v.version,CASE WHEN v.source->>'kind'='character' THEN 'optimize_queued' ELSE 'texture_queued' END FROM coedit_generation_versions v JOIN coedit_generation_jobs j ON j.id=v.job_id AND j.current_version=v.version WHERE v.state='shape_ready' ON CONFLICT DO NOTHING");}
 async get(scope:Scope,jobId:string,version:number):Promise<FinishingRecord>{
  const row=(await this.pool.query(select+' WHERE j.id=$1 AND f.version=$2 AND j.actor=$3 AND j.room_id=$4 AND j.current_version=f.version',[jobId,version,scope.actor,scope.roomKey])).rows[0];
  if(scope.role!=='student'||!row)throw Error('FORBIDDEN');return row;
 }
 async find(scope:Scope,jobId:string,version:number):Promise<FinishingRecord|null>{
  const row=(await this.pool.query(select+' WHERE j.id=$1 AND f.version=$2 AND j.actor=$3 AND j.room_id=$4 AND j.current_version=f.version',[jobId,version,scope.actor,scope.roomKey])).rows[0];
  if(scope.role!=='student')throw Error('FORBIDDEN');return row??null;
 }
 async pending():Promise<PendingFinish[]>{return (await this.pool.query(`SELECT ${columns},j.actor,j.room_id AS "roomId",j.generation,v.image_key AS "imageKey",v.shape_key AS "shapeKey",v.source,v.target FROM coedit_generation_finishing f JOIN coedit_generation_jobs j ON j.id=f.job_id AND j.current_version=f.version JOIN coedit_generation_versions v ON v.job_id=f.job_id AND v.version=f.version WHERE f.phase IN ('texture_queued','optimize_queued') AND v.state='shape_ready' ORDER BY f.created_at LIMIT 100`)).rows;}
 async textureFailed(jobId:string,version:number,error:string){await this.pool.query("UPDATE coedit_generation_finishing SET phase='material_choice',error=$3,updated_at=now() WHERE job_id=$1 AND version=$2 AND phase='texture_queued'",[jobId,version,error.slice(0,120)]);}
 async textureReady(jobId:string,version:number,key:string){objectKeySchema.parse(key);await this.pool.query("UPDATE coedit_generation_finishing SET phase='optimize_queued',texture_key=$3,updated_at=now() WHERE job_id=$1 AND version=$2 AND phase='texture_queued'",[jobId,version,key]);}
 async choosePreset(scope:Scope,jobId:string,version:number,raw:unknown){
  const preset=materialPresetSchema.parse(raw);await this.get(scope,jobId,version);
  await this.pool.query("UPDATE coedit_generation_finishing SET phase='optimize_queued',preset=$3,updated_at=now() WHERE job_id=$1 AND version=$2 AND phase='material_choice'",[jobId,version,preset]);
  const row=await this.get(scope,jobId,version);if(row.preset!==preset)throw Error('PRESET_ALREADY_SELECTED');return row;
 }
 async artifactReady(jobId:string,version:number,artifactId:string,staleScene=false){objectKeySchema.parse(artifactId);await this.pool.query("UPDATE coedit_generation_finishing SET phase='pending_approval',artifact_id=$3,stale_scene=$4,error=NULL,updated_at=now() WHERE job_id=$1 AND version=$2 AND phase='optimize_queued'",[jobId,version,artifactId,staleScene]);}
 async fail(jobId:string,version:number,error:string){
  const db=await this.pool.connect();try{await db.query('BEGIN');
   const result=await db.query("UPDATE coedit_generation_finishing SET phase='failed',error=$3,updated_at=now() WHERE job_id=$1 AND version=$2 AND phase='optimize_queued' RETURNING job_id",[jobId,version,error.slice(0,120)]);
   if(result.rowCount)await db.query("UPDATE coedit_generation_versions SET state='failed',charged=false,error=$3 WHERE job_id=$1 AND version=$2 AND state='shape_ready'",[jobId,version,error.slice(0,120)]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
}
