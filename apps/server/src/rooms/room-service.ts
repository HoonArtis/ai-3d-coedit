import {emptyScene,parseCommand,parseSnapshot,previewSchema,type AssetDefinition,type SceneSnapshot,type Session,type CommandResult,type Lease} from '@coedit/contracts';
import {applyExpandedCommand,mutationTargets} from './expand-command';
import {LockService} from './locks';
import {HistoryService} from './history';
import {restoreScene,canWrite,type ResolvedRestoration} from '@coedit/domain';
export class RoomService {
  snapshot:SceneSnapshot;
  private members=new Map<string,Session>();private lockService:LockService;private history=new HistoryService();
  private requests=new Map<string,{fingerprint:string;result:CommandResult}>();
  private library:Record<string,AssetDefinition>;
  constructor(roomId:string,library:Record<string,AssetDefinition>,now=Date.now){
    this.snapshot=emptyScene(roomId);this.library=library;this.lockService=new LockService(now);
  }
  get locks():Record<string,Lease>{return this.lockService.public;}
  setLibrary(library:Record<string,AssetDefinition>){this.library=structuredClone(library);}
  getLibrary(){return structuredClone(this.library);}
  get count(){return this.members.size;}
  getSession(clientId:string){const session=this.members.get(clientId);if(!session)throw Error('UNAUTHENTICATED');return session;}
  inspectMutation(clientId:string,raw:unknown,id:string){
    const session=this.getSession(clientId),command=parseCommand(raw,session),object=this.snapshot.objects[id];if(!object)throw Error('NOT_FOUND');
    this.lockService.expire();const previous=this.lockService.forClient(clientId);
    if(command.source==='chat')this.lockService.acquire(clientId,session,[id],this.snapshot);
    try{
      const locks=this.lockService.forClient(clientId);
      if(command.source==='chat'&&locks[id])command.lockTokens[id]=locks[id].token;
      canWrite(object,command,{...session,library:this.library,locks});return {object:structuredClone(object),generation:this.snapshot.generation};
    }finally{if(command.source==='chat'&&!previous[id])this.lockService.release(clientId,[id]);}
  }
  exportState(){return {snapshot:structuredClone(this.snapshot),history:this.history.exportState()};}
  importState(state:ReturnType<RoomService['exportState']>){
    const snapshot=parseSnapshot(state.snapshot);if(snapshot.roomId!==this.snapshot.roomId)throw Error('WRONG_ROOM');
    this.history.importState(state.history);this.snapshot=snapshot;
  }
  fork(){
    const copy=new RoomService(this.snapshot.roomId,this.library);copy.importState(this.exportState());
    copy.members=structuredClone(this.members);copy.lockService=this.lockService.fork();copy.requests=structuredClone(this.requests);return copy;
  }
  accept(candidate:RoomService){
    this.importState(candidate.exportState());this.requests=candidate.requests;
    this.lockService.release('',Object.keys(this.locks).filter(id=>!Object.hasOwn(this.snapshot.objects,id)),true);
  }
  join(clientId:string,session:Session){
    if(this.members.has(clientId))return;
    if(session.role!=='teacher'&&[...this.members.values()].filter(s=>s.role!=='teacher').length>=5)throw Error('ROOM_FULL');
    this.members.set(clientId,session);
  }
  leave(clientId:string){this.members.delete(clientId);this.lockService.disconnect(clientId);}
  drop(clientId:string){this.lockService.disconnect(clientId);}
  expireLocks(){this.lockService.expire();}
  heartbeat(clientId:string){if(this.members.has(clientId))this.lockService.heartbeat(clientId);}
  preview(clientId:string,raw:unknown){
    const parsed=previewSchema.safeParse(raw),session=this.members.get(clientId);
    if(!parsed.success||!session)return null;
    this.lockService.expire();const event=parsed.data,lease=this.lockService.forClient(clientId)[event.id];
    const object=this.snapshot.objects[event.id];
    if(!lease||lease.token!==event.token||!object||(object.owner!==session.actor&&session.role!=='teacher'))return null;
    return event;
  }
  submit(clientId:string,raw:unknown,restoration?:ResolvedRestoration):CommandResult{
    try{
      const session=this.members.get(clientId);if(!session)throw Error('UNAUTHENTICATED');
      const command=parseCommand(raw,session);
      if(command.expectedGeneration!==undefined&&command.expectedGeneration!==this.snapshot.generation)throw Error('SCENE_RESTORED');
      const key=session.actor+':'+command.requestId,fingerprint=JSON.stringify(command),cached=this.requests.get(key);
      if(cached)return cached.fingerprint===fingerprint?structuredClone(cached.result):{ok:false,code:'REQUEST_CONFLICT',message:'같은 요청 ID의 내용이 달라요.'};
      this.lockService.expire();
      let result:CommandResult;const first=command.ops[0];
      if(['lock','unlock','force_unlock','undo','redo'].includes(first.op)&&command.ops.length!==1)throw Error('SINGLE_CONTROL_REQUIRED');
      if(first.op==='lock'||first.op==='unlock'||first.op==='force_unlock'){
        if(first.op==='force_unlock'&&session.role!=='teacher')throw Error('FORBIDDEN');
        if(first.op==='lock')this.lockService.acquire(clientId,session,first.ids,this.snapshot);
        else this.lockService.release(clientId,first.ids,first.op==='force_unlock');
        result={ok:true,snapshot:structuredClone(this.snapshot),changedIds:[]};
      }else if(command.ops.some(op=>op.op==='restore_object'||op.op==='restore_snapshot')){
        if(session.role!=='teacher')throw Error('FORBIDDEN');
        if(!restoration)throw Error('RESTORATION_UNAVAILABLE');
        if(first.op==='restore_snapshot'){
          if(command.ops.length!==1||!('snapshot' in restoration))throw Error('INVALID_RESTORATION');
        }else{
          if(!command.ops.every(op=>op.op==='restore_object')||!('objects' in restoration))throw Error('INVALID_RESTORATION');
          const ids=command.ops.map(op=>op.op==='restore_object'?op.id:'');
          if(new Set(ids).size!==ids.length||ids.length!==Object.keys(restoration.objects).length||ids.some(id=>!Object.hasOwn(restoration.objects,id)))throw Error('INVALID_RESTORATION');
        }
        const change=restoreScene(this.snapshot,restoration,{...session,library:this.library,locks:this.locks});
        const previousLocks=this.lockService.forClient(clientId);
        this.lockService.acquire(clientId,session,change.changedIds,this.snapshot,true);
        this.history.invalidate(change.changedIds,session.actor,change.snapshot.seq,'snapshot' in restoration);
        this.snapshot=change.snapshot;
        this.lockService.release(clientId,change.changedIds.filter(id=>!previousLocks[id]||!Object.hasOwn(this.snapshot.objects,id)));
        result={ok:true,...structuredClone(change)};
      }else if(first.op==='undo'||first.op==='redo'){
        if(session.role==='viewer')throw Error('READ_ONLY');
        const entry=this.history.peek(session.actor,first.op==='redo');if(!entry)throw Error('HISTORY_EMPTY');
        if(first.op==='undo'&&first.expectedSeq!==undefined&&first.expectedSeq!==entry.expectedSeq)throw Error('HISTORY_NOT_LATEST');
        const ids=Object.keys(entry.before),oldLocks=this.lockService.forClient(clientId);
        this.lockService.acquire(clientId,session,ids,this.snapshot,true);
        try{
          const change=this.history.apply(this.snapshot,session,first.op==='redo');
          this.snapshot=change.snapshot;result={ok:true,...structuredClone(change)};
        }finally{
          this.lockService.release(clientId,ids.filter(id=>!oldLocks[id]));
        }
      }else{
        const oldLocks=this.lockService.forClient(clientId);
        const temporary=command.source==='chat'?mutationTargets(command.ops):[];
        if(temporary.length){
          const created=new Set(command.ops.flatMap(op=>op.op==='place'?[op.id]:op.op==='arrange_around'||op.op==='scatter'?op.ids:[]));
          if(temporary.some(id=>!Object.hasOwn(this.snapshot.objects,id)&&!created.has(id)))throw Error('NOT_FOUND');
          this.lockService.acquire(clientId,session,temporary,this.snapshot,true);
        }
        try{
          const locks=this.lockService.forClient(clientId);
          const effective=command.source==='chat'?{...command,lockTokens:Object.fromEntries(Object.entries(locks).map(([id,l])=>[id,l.token]))}:command;
          result=applyExpandedCommand(this.snapshot,effective,{...session,library:this.library,locks});
        }finally{this.lockService.release(clientId,temporary.filter(id=>!oldLocks[id]));}
        if(result.ok&&result.changedIds.length){
          this.history.record(this.snapshot,result.snapshot,result.changedIds,session.actor);
          this.snapshot=result.snapshot;
          this.lockService.release(clientId,result.changedIds.filter(id=>!Object.hasOwn(this.snapshot.objects,id)),true);
        }
      }
      if(result.ok){
        this.requests.set(key,{fingerprint,result:structuredClone(result)});
        if(this.requests.size>5000)this.requests.delete(this.requests.keys().next().value!);
      }
      return result;
    }catch(error){
      const code=error instanceof Error?error.message:'INVALID_COMMAND';
      return {ok:false,code,message:code==='FORBIDDEN'?'이 작업에 필요한 수정 권한이 없어요. 다른 계정이 만든 물건은 강사에게 이동을 요청하거나, 내 계정으로 새 물건을 배치해 주세요.':code==='SCENE_RESTORED'?'작품이 복원되어 이전 요청을 취소했어요. 새 작품에서 다시 요청해 주세요.':code==='HISTORY_CONFLICT'?'선생님이나 다른 작업이 수정한 에셋이에요.':code==='HISTORY_EMPTY'?'되돌릴 작업이 없어요.':code==='HISTORY_NOT_LATEST'?'그 뒤에 다른 편집을 했어요. 상단 되돌리기로 최근 작업부터 취소해 주세요.':code==='LOCKED'?'다른 작업자가 선택한 에셋이에요.':'요청을 처리할 수 없어요. '+code};
    }
  }
}
