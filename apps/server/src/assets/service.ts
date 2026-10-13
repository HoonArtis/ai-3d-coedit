import {exportBuiltinGlb} from '@coedit/geometry/export';
import {readFile} from 'node:fs/promises';
import {artifactManifestSchema,objectKeySchema,BUILTIN_LIBRARY,type AssetDefinition,type Session} from '@coedit/contracts';
import type {ObjectStore} from '@coedit/artifacts';
import type {AccountService} from '../accounts/service';
type ArtifactRow={artifact_id:string;job_id:string;version:number;generation:number;actor:string;class_id:string;teacher_id:string;phase:string;source:{kind:string;prompt?:string}};
const select=`SELECT f.artifact_id,f.job_id,f.version,f.phase,j.actor,j.class_id,j.generation,c.teacher_id,v.source FROM coedit_generation_finishing f JOIN coedit_generation_jobs j ON j.id=f.job_id JOIN coedit_classes c ON c.id=j.class_id JOIN coedit_generation_versions v ON v.job_id=f.job_id AND v.version=f.version`;
export class AssetService{
 constructor(private accounts:AccountService,private store:ObjectStore){}
 async migrate(){await this.accounts.pool.query(await readFile(new URL('../../../../infra/migrations/005-approval.sql',import.meta.url),'utf8'));}
 private async teacher(token:string,classId:string){
  return this.accounts.requireTeacherClass(token,classId);
 }
 private async manifest(row:ArtifactRow){
  const manifest=artifactManifestSchema.parse(JSON.parse(new TextDecoder().decode(await this.store.get(row.artifact_id))));
  if(manifest.jobId!==row.job_id||manifest.version!==row.version||manifest.generation!==row.generation)throw Error('ARTIFACT_CONTEXT_MISMATCH');return manifest;
 }
 private async definition(row:ArtifactRow):Promise<AssetDefinition>{
  const manifest=await this.manifest(row);
  return {id:'generated-'+row.artifact_id,name:manifest.character?'업로드한 캐릭터':row.source.kind==='text'?(row.source.prompt??'새 에셋').slice(0,80):'업로드한 에셋',kind:'generated',color:'#78a7ac',dimensions:manifest.desktop.dimensions,artifactId:row.artifact_id,...(manifest.character?{character:true}:{})};
 }
 async listApprovals(token:string,classId:string){
  await this.teacher(token,classId);
  const rows=(await this.accounts.pool.query(select+" WHERE j.class_id=$1 AND f.phase IN ('pending_approval','approved','rejected') ORDER BY f.created_at DESC LIMIT 100",[classId])).rows as ArtifactRow[];
  return Promise.all(rows.map(async row=>({jobId:row.job_id,version:row.version,phase:row.phase,actor:row.actor,generation:row.generation,asset:await this.definition(row),manifest:await this.manifest(row)})));
 }
 async decide(token:string,classId:string,jobId:string,version:number,decision:'approved'|'rejected'){
  if(decision!=='approved'&&decision!=='rejected')throw Error('INVALID_DECISION');
  const session=await this.teacher(token,classId),db=await this.accounts.pool.connect();
  try{
   await db.query('BEGIN');
   const row=(await db.query(select+' WHERE j.class_id=$1 AND j.id=$2 AND f.version=$3 FOR UPDATE OF f',[classId,jobId,version])).rows[0] as ArtifactRow|undefined;
   if(!row)throw Error('FORBIDDEN');if(row.phase!==decision&&row.phase!=='pending_approval')throw Error('DECISION_CONFLICT');
   if(row.phase==='pending_approval'){
    const manifest=await this.manifest(row);await this.store.get(manifest.desktop.key);if(manifest.character){await this.store.get(manifest.character.avatarKey);await this.store.get(manifest.character.vrKey);}
    await db.query('UPDATE coedit_generation_finishing SET phase=$3,review_actor=$4,reviewed_at=now(),updated_at=now() WHERE job_id=$1 AND version=$2',[jobId,version,decision,session.actor]);
   }
   await db.query('COMMIT');return {jobId,version,phase:decision};
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 /** Internal room adapter: callers expose results only after room session authentication. */
 async catalogForRoom(roomId:string):Promise<Record<string,AssetDefinition>>{
  const rows=(await this.accounts.pool.query(select+" WHERE j.class_id=(SELECT class_id FROM coedit_class_rooms WHERE id=$1) AND f.phase='approved' ORDER BY f.created_at LIMIT 1000",[roomId])).rows as ArtifactRow[];
  const definitions=await Promise.all(rows.map(row=>this.definition(row)));return Object.fromEntries(definitions.map(asset=>[asset.id,asset]));
 }
 async library(token:string,roomId:string){await this.accounts.resolveRoomToken(token,roomId);return this.catalogForRoom(roomId);}
 async retextureSource(scope:Session&{roomKey:string},assetId:string){
  if(scope.role!=='student')throw Error('FORBIDDEN');
  if(Object.hasOwn(BUILTIN_LIBRARY,assetId)){
   const member=(await this.accounts.pool.query('SELECT id FROM coedit_students WHERE id=$1 AND room_id=$2',[scope.actor,scope.roomKey])).rowCount;if(!member)throw Error('FORBIDDEN');
   return {shapeKey:await this.store.put(await exportBuiltinGlb(BUILTIN_LIBRARY[assetId]))};
  }
  if(!assetId.startsWith('generated-'))throw Error('ASSET_UNAVAILABLE');
  const artifactId=objectKeySchema.parse(assetId.slice('generated-'.length));
  const row=(await this.accounts.pool.query(select+" WHERE f.artifact_id=$1 AND f.phase='approved' AND j.class_id=(SELECT r.class_id FROM coedit_class_rooms r JOIN coedit_students s ON s.room_id=r.id WHERE r.id=$2 AND s.id=$3)",[artifactId,scope.roomKey,scope.actor])).rows[0] as ArtifactRow|undefined;
  if(!row)throw Error('FORBIDDEN');
  const manifest=await this.manifest(row);if(manifest.character)throw Error('CHARACTER_RETEXTURE_UNSUPPORTED');await this.store.get(manifest.originalKey);
  return {shapeKey:manifest.originalKey};
 }
 /** Server-selected, latest approved upload owned by the authenticated viewer. */
 async avatarFor(actor:string,roomId:string):Promise<string|null>{
  const row=(await this.accounts.pool.query(select+" WHERE j.actor=$1 AND j.room_id=$2 AND f.phase='approved' AND v.source->>'kind'='character' ORDER BY f.created_at DESC LIMIT 1",[actor,roomId])).rows[0] as ArtifactRow|undefined;
  if(!row)return null;
  try{const manifest=await this.manifest(row);if(!manifest.character)return null;await this.store.get(manifest.character.avatarKey);return row.artifact_id;}catch{return null;}
 }
 async file(token:string,artifactId:string,preview:boolean,avatar=false){
  objectKeySchema.parse(artifactId);const session=await this.accounts.session(token);
  const row=(await this.accounts.pool.query(select+' WHERE f.artifact_id=$1',[artifactId])).rows[0] as ArtifactRow|undefined;if(!row)throw Error('FORBIDDEN');
  let allowed=session.role==='teacher'&&row.teacher_id===session.actor;
  if(session.role==='student'){
   const sameClass=(await this.accounts.pool.query('SELECT s.id FROM coedit_students s JOIN coedit_class_rooms r ON r.id=s.room_id WHERE s.id=$1 AND r.class_id=$2',[session.actor,row.class_id])).rowCount;
   allowed=Boolean(sameClass)&&(row.phase==='approved'||preview&&row.actor===session.actor);
  }
  if(!allowed||!preview&&row.phase!=='approved')throw Error('FORBIDDEN');
  const manifest=await this.manifest(row);if(avatar&&!manifest.character)throw Error('CHARACTER_REQUIRED');return this.store.get(avatar?manifest.character!.avatarKey:manifest.desktop.key);
 }
}
