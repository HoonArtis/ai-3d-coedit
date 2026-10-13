import type {Pool} from 'pg';
import {emptyScene,parseSnapshot,historyQuerySchema,roomHistorySchema,type Command,type Session,type SceneObject} from '@coedit/contracts';
import type {ResolvedRestoration} from '@coedit/domain';
import type {AccountService} from '../accounts/service';
import type {SubmissionService} from './submissions';
export interface RestorationResolver{resolve(roomId:string,session:Session,command:Command):Promise<ResolvedRestoration>}
export class RoomHistoryService implements RestorationResolver{
  constructor(private pool:Pool,private accounts:AccountService,private submissions?:SubmissionService){}
  async list(token:string,roomId:string,raw:unknown){
    const session=await this.accounts.resolveRoomToken(token,roomId);if(session.role!=='teacher')throw Error('FORBIDDEN');
    const query=historyQuerySchema.parse(raw);
    const {rows}=await this.pool.query(`SELECT c.seq,c.actor,c.request_id,c.fingerprint,c.result,p.result AS previous
      FROM coedit_commands c LEFT JOIN coedit_commands p ON p.room_id=c.room_id AND p.seq=c.seq-1
      WHERE c.room_id=$1 AND ($2::bigint IS NULL OR c.seq<$2) AND ($3::text IS NULL OR c.result->'changedIds' ? $3)
      ORDER BY c.seq DESC LIMIT $4`,[roomId,query.before??null,query.objectId??null,query.limit+1]);
    const entries=rows.slice(0,query.limit).map(row=>{
      const snapshot=parseSnapshot(row.result.snapshot),previous=row.previous?parseSnapshot(row.previous.snapshot):emptyScene(roomId);
      if(snapshot.roomId!==roomId||previous.roomId!==roomId)throw Error('CORRUPT_ROOM_LOG');
      return {seq:Number(row.seq),actor:row.actor,source:JSON.parse(row.fingerprint).source,requestId:row.request_id,changedIds:row.result.changedIds,snapshotId:'seq-'+row.seq,...(query.objectId?{before:previous.objects[query.objectId]??null,after:snapshot.objects[query.objectId]??null}:{})};
    });
    return roomHistorySchema.parse({entries,nextCursor:rows.length>query.limit?entries.at(-1)!.seq:null});
  }
  async resolve(roomId:string,session:Session,command:Command):Promise<ResolvedRestoration>{
    if(session.role!=='teacher')throw Error('FORBIDDEN');
    const first=command.ops[0];
    if(first.op==='restore_snapshot'){
      if(command.ops.length!==1)throw Error('INVALID_RESTORATION');
      if(/^seq-(0|[1-9]\d*)$/.test(first.snapshotId)){
        const seq=Number(first.snapshotId.slice(4));if(!Number.isSafeInteger(seq))throw Error('REVISION_NOT_FOUND');
        return {snapshot:seq===0?emptyScene(roomId):(await this.revision(roomId,seq)).snapshot};
      }
      if(this.submissions)return {snapshot:await this.submissions.read(roomId,first.snapshotId)};
      throw Error('REVISION_NOT_FOUND');
    }
    const objects:Record<string,SceneObject|null>={};
    for(const op of command.ops){
      if(op.op!=='restore_object'||Object.hasOwn(objects,op.id))throw Error('INVALID_RESTORATION');
      if(op.revision===0){objects[op.id]=null;continue;}
      const revision=await this.revision(roomId,op.revision);
      if(!revision.changedIds.includes(op.id))throw Error('REVISION_NOT_FOUND');
      objects[op.id]=revision.snapshot.objects[op.id]??null;
    }
    return {objects};
  }
  private async revision(roomId:string,seq:number){
    const {rows}=await this.pool.query('SELECT result FROM coedit_commands WHERE room_id=$1 AND seq=$2',[roomId,seq]);
    if(!rows.length)throw Error('REVISION_NOT_FOUND');const result=rows[0].result,snapshot=parseSnapshot(result.snapshot);
    if(snapshot.roomId!==roomId||snapshot.seq!==seq)throw Error('CORRUPT_ROOM_LOG');
    return {snapshot,changedIds:result.changedIds as string[]};
  }
}
