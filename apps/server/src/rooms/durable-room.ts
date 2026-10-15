import {parseCommand,type CommandResult} from '@coedit/contracts';
import type {RoomRepository} from '../storage/room-repository';
import {RoomService} from './room-service';
import type {RestorationResolver} from '../storage/room-history';
export class DurableRoom{
  private queue:Promise<unknown>=Promise.resolve();
  private constructor(readonly service:RoomService,private repository:RoomRepository,private restoration?:RestorationResolver){}
  static async open(service:RoomService,repository:RoomRepository,restoration?:RestorationResolver){
    await repository.create(service.exportState());const state=await repository.load(service.snapshot.roomId);
    if(!state)throw Error('ROOM_NOT_FOUND');service.importState(state);return new DurableRoom(service,repository,restoration);
  }
  submit(clientId:string,raw:unknown):Promise<CommandResult>{
    const execute=async():Promise<CommandResult>=>{
      try{
        const command=parseCommand(raw,this.service.getSession(clientId));
        const previous=await this.repository.lookup(this.service.snapshot.roomId,command.actor,command.requestId);
        if(previous)return previous.fingerprint===JSON.stringify(command)?previous.result:{ok:false,code:'REQUEST_CONFLICT',message:'같은 요청 ID의 내용이 달라요.'};
        const control=command.ops.every(op=>['lock','unlock','force_unlock','list','find','describe_scene','recommend'].includes(op.op));
        if(control)return this.service.submit(clientId,command);
        let restoration;
        if(command.ops.some(op=>op.op==='restore_object'||op.op==='restore_snapshot')){
          const session=this.service.getSession(clientId);
          if(session.role!=='teacher')return {ok:false,code:'FORBIDDEN',message:'강사만 복원할 수 있어요.'};
          if(!this.restoration)return {ok:false,code:'RESTORATION_UNAVAILABLE',message:'복원 서비스를 사용할 수 없어요.'};
          try{restoration=await this.restoration.resolve(this.service.snapshot.roomId,session,command);}
          catch(error){return {ok:false,code:error instanceof Error?error.message:'REVISION_NOT_FOUND',message:'요청한 복원 이력을 읽을 수 없어요.'};}
        }
        const candidate=this.service.fork();const result=candidate.submit(clientId,command,restoration);
        if(!result.ok)return result;
        if(result.snapshot.seq>this.service.snapshot.seq){
          await this.repository.commit(this.service.snapshot.seq,candidate.exportState(),command,result);
          this.service.accept(candidate);
        }
        return result;
      }catch(error){return {ok:false,code:error instanceof Error&&error.message==='SEQ_CONFLICT'?'SEQ_CONFLICT':'PERSISTENCE_ERROR',message:'저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.'};}
    };
    const result=this.queue.then(execute,execute);this.queue=result;return result;
  }
}
