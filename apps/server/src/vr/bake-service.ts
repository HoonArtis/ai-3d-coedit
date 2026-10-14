import {readFile} from 'node:fs/promises';
import {AvatarProfileService} from './avatar-profile-service';
import {BUILTIN_LIBRARY,idSchema,objectKeySchema,vrSourceSchema,vrBakeRecordSchema,vrManifestSchema,vrEnvironmentSchema,type JobInput} from '@coedit/contracts';
import {boundsOf,findSpawn} from '@coedit/placement';
import type {ObjectStore} from '@coedit/artifacts';
import type {JobQueues} from '@coedit/jobs';
import type {AccountService} from '../accounts/service';
import type {SubmissionService} from '../storage/submissions';
import type {AssetService} from '../assets/service';
export class VrBakeService{
  readonly profiles:AvatarProfileService;
  constructor(private accounts:AccountService,private submissions:SubmissionService,private queues:JobQueues,private store:ObjectStore,private assets:Pick<AssetService,'catalogForRoom'>&Partial<Pick<AssetService,'avatarFor'>>){this.profiles=new AvatarProfileService(accounts);}
  async avatarFor(actor:string,roomId:string){return await this.assets.avatarFor?.(actor,roomId)??null;}
  viewerSession(token:unknown,roomId:unknown){return this.accounts.resolveRoomToken(token,roomId,true);}
  async migrate(){await this.accounts.pool.query(await readFile(new URL('../../../../infra/migrations/007-vr.sql',import.meta.url),'utf8'));await this.profiles.migrate();}
  async submit(token:string,roomId:string,requestId:string){
    const session=await this.accounts.resolveRoomToken(token,roomId);
    return this.submissions.submit(roomId,{actor:session.actor,requestId:idSchema.parse(requestId)});
  }
  async register(token:string,roomId:string,snapshotId:string){
    const session=await this.accounts.resolveRoomToken(token,roomId);idSchema.parse(snapshotId);
    const previous=(await this.accounts.pool.query('SELECT b.source_key FROM coedit_vr_bakes b JOIN coedit_submissions s ON s.id=b.snapshot_id WHERE b.snapshot_id=$1 AND s.room_id=$2',[snapshotId,roomId])).rows[0];
    if(previous)return {snapshotId,sourceKey:previous.source_key as string};
    const snapshot=await this.submissions.read(roomId,snapshotId),catalog={...BUILTIN_LIBRARY,...await this.assets.catalogForRoom(roomId)},used=new Set(Object.values(snapshot.objects).map(object=>object.assetId));
    const source=vrSourceSchema.parse({formatVersion:1,snapshotId,snapshot,library:Object.fromEntries([...used].filter(id=>Object.hasOwn(catalog,id)).map(id=>[id,catalog[id]]))});
    const sourceKey=await this.store.put(new TextEncoder().encode(JSON.stringify(source)));
    const {rows}=await this.accounts.pool.query('INSERT INTO coedit_vr_bakes(snapshot_id,actor,source_key) VALUES($1,$2,$3) ON CONFLICT(snapshot_id) DO UPDATE SET snapshot_id=coedit_vr_bakes.snapshot_id RETURNING source_key',[snapshotId,session.actor,sourceKey]);
    return {snapshotId,sourceKey:rows[0].source_key as string};
  }
  async enqueuePending(){
    const {rows}=await this.accounts.pool.query("SELECT b.*,s.room_id,s.generation FROM coedit_vr_bakes b JOIN coedit_submissions s ON s.id=b.snapshot_id WHERE b.state='queued' ORDER BY b.created_at LIMIT 100");
    for(const row of rows){
      const input:JobInput={jobId:row.snapshot_id,inputVersion:1,actor:row.actor,roomId:row.room_id,generation:Number(row.generation),stage:'vr-bake',payload:{sourceKey:row.source_key}};
      const jobId=await this.queues.enqueue(input),status=await this.queues.status(jobId);
      if(status?.status==='failed')await this.accounts.pool.query("UPDATE coedit_vr_bakes SET state='failed',error='VR_BAKE_FAILED' WHERE snapshot_id=$1 AND state='queued'",[row.snapshot_id]);
      if(status?.status==='completed'){
        try{
          const manifestId=objectKeySchema.parse((status.result as {manifestId?:unknown}|undefined)?.manifestId);
          await this.verifyManifest(manifestId,row.snapshot_id,row.source_key);
          await this.accounts.pool.query("UPDATE coedit_vr_bakes SET state='ready',manifest_id=$2,error=NULL WHERE snapshot_id=$1 AND state='queued'",[row.snapshot_id,manifestId]);
        }catch{
          await this.accounts.pool.query("UPDATE coedit_vr_bakes SET state='failed',error='INVALID_VR_RESULT' WHERE snapshot_id=$1 AND state='queued'",[row.snapshot_id]);
        }
      }
    }
  }
  private async verifyManifest(manifestId:string,snapshotId:string,sourceKey:string){
    const manifest=vrManifestSchema.parse(JSON.parse(new TextDecoder().decode(await this.store.get(manifestId))));
    const source=vrSourceSchema.parse(JSON.parse(new TextDecoder().decode(await this.store.get(sourceKey))));
    const objects=Object.values(source.snapshot.objects),expectedAssets=[...new Set(objects.map(o=>o.assetId))].sort();
    if(manifest.snapshotId!==snapshotId||manifest.sourceKey!==sourceKey||manifest.roomId!==source.snapshot.roomId||manifest.seq!==source.snapshot.seq||manifest.generation!==source.snapshot.generation||JSON.stringify([...manifest.objects].sort())!==JSON.stringify(objects.map(o=>o.id).sort())||JSON.stringify(manifest.assets.map(a=>a.id).sort())!==JSON.stringify(expectedAssets))throw Error('VR_MANIFEST_MISMATCH');
    const triangles=new Map(manifest.assets.map(a=>[a.id,a.triangles]));
    if(manifest.triangles!==objects.reduce((n,o)=>n+triangles.get(o.assetId)!,0))throw Error('VR_TRIANGLE_MISMATCH');
    await this.store.get(manifest.key);return manifest;
  }
  async artifact(token:string,roomId:string,snapshotId:string){
    await this.accounts.resolveRoomToken(token,roomId,true);
    const row=(await this.accounts.pool.query("SELECT b.manifest_id,b.source_key FROM coedit_vr_bakes b JOIN coedit_submissions s ON s.id=b.snapshot_id WHERE b.snapshot_id=$1 AND s.room_id=$2 AND b.state='ready'",[snapshotId,roomId])).rows[0];
    if(!row)throw Error('VR_NOT_READY');
    const manifest=await this.verifyManifest(row.manifest_id,snapshotId,row.source_key);
    return {manifest,bytes:await this.store.get(manifest.key)};
  }
  async environment(token:string,roomId:string,snapshotId:string){
    const {manifest}=await this.artifact(token,roomId,snapshotId);
    const source=vrSourceSchema.parse(JSON.parse(new TextDecoder().decode(await this.store.get(manifest.sourceKey))));
    const obstacles=Object.values(source.snapshot.objects).map(object=>boundsOf(object,source.library[object.assetId]));
    return vrEnvironmentSchema.parse({manifest,obstacles,spawn:findSpawn(obstacles)});
  }
  async list(token:string,roomId:string){
    await this.accounts.resolveRoomToken(token,roomId,true);
    const {rows}=await this.accounts.pool.query('SELECT b.snapshot_id AS "snapshotId",s.room_id AS "roomId",s.seq,s.generation,b.state,b.manifest_id AS "manifestId",b.error FROM coedit_vr_bakes b JOIN coedit_submissions s ON s.id=b.snapshot_id WHERE s.room_id=$1 ORDER BY b.created_at DESC LIMIT 100',[roomId]);
    return rows.map(row=>vrBakeRecordSchema.parse({...row,seq:Number(row.seq),generation:Number(row.generation)}));
  }
}
