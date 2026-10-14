import {chatRequestSchema,parseStudentDecision,type Command,type CommandResult,type ChatReply,type ChatUpdate,type ChatMessage} from '@coedit/contracts';
import type {JobQueues} from '@coedit/jobs';
import type {RoomService} from '../rooms/room-service';
import {ChatRepository} from './repository';
export class ChatService{
 private inFlight=new Map<string,{fingerprint:string;promise:Promise<ChatReply>}>();
 constructor(private repository:ChatRepository,private queues:JobQueues,private timeoutMs=120000){}
 history(room:RoomService,clientId:string){return this.repository.history(room.snapshot.roomId,room.getSession(clientId).actor);}
 pending(room:RoomService,clientId:string){return this.repository.pending(room.snapshot.roomId,room.getSession(clientId).actor);}
 cancel(room:RoomService,clientId:string,requestId:string){return this.repository.cancel(room.snapshot.roomId,room.getSession(clientId).actor,requestId);}
 async request(room:RoomService,clientId:string,raw:unknown,submit:(command:Command)=>Promise<CommandResult>,emit:(event:ChatUpdate)=>void):Promise<ChatReply>{
  const input=chatRequestSchema.parse(raw),session=room.getSession(clientId);
  if(session.role==='viewer')throw Error('FORBIDDEN');
  const roomId=room.snapshot.roomId,key=JSON.stringify([roomId,session.actor,input.requestId]),fingerprint=JSON.stringify(input),pending=this.inFlight.get(key);
  if(pending){if(pending.fingerprint!==fingerprint)throw Error('REQUEST_CONFLICT');return pending.promise;}
  const promise=(async()=>{
   const prior=await this.repository.begin(roomId,session.actor,input);if(prior)return prior;
   const history=await this.repository.history(roomId,session.actor);
   const lastSuccess=history.findLastIndex(r=>r.result?.ok),clarified=history.slice(lastSuccess+1).some(r=>!!r.clarification);
   try{
    const messages:ChatMessage[]=history.slice(-19).flatMap(r=>[{role:'user' as const,content:r.message},{role:'assistant' as const,content:r.summary}]);messages.push({role:'user',content:input.message});
    const jobInput=await this.repository.jobInput(roomId,session.actor,input.requestId,{jobId:input.requestId,inputVersion:1,actor:session.actor,roomId,generation:room.snapshot.generation,stage:'llm',payload:{messages,context:JSON.parse(JSON.stringify({actor:session.actor,selectedId:input.selectedId,cameraCenter:input.cameraCenter,scene:room.snapshot,library:room.getLibraryFor(clientId),clarified}))}});
    const jobId=await this.queues.enqueue(jobInput);
    const deadline=Date.now()+this.timeoutMs;let output:unknown;
    for(;;){
     const final=await this.repository.response(roomId,session.actor,input.requestId);if(final)return final;
     const state=await this.queues.status(jobId);if(!state)throw Error('JOB_MISSING');
     if(state.status==='completed'){output=state.result;break;}
     if(state.status==='failed')throw Error(state.error??'MODEL_FAILED');
     if(Date.now()>deadline)throw Error('CHAT_TIMEOUT');
     emit({type:'queued',requestId:input.requestId,position:state.position});
     await new Promise(resolve=>setTimeout(resolve,100));
    }
    await this.repository.model(roomId,session.actor,input.requestId,output);
    const decision=parseStudentDecision(output);
    if(clarified&&decision.clarification){decision.summary='대상을 선택한 뒤 다시 요청해 주세요.';decision.clarification=null;}
    const reply:ChatReply={requestId:input.requestId,...decision};
    if(decision.ops.length&&jobInput.generation!==room.snapshot.generation)throw Error('SCENE_RESTORED');
    if(decision.ops.length){
     if(!await this.repository.claimApply(roomId,session.actor,input.requestId))return (await this.repository.response(roomId,session.actor,input.requestId))!;
     reply.result=await submit({version:1,actor:session.actor,source:'chat',requestId:input.requestId,expectedGeneration:jobInput.generation,ops:decision.ops,lockTokens:{}});
    }
    if(reply.result&&!reply.result.ok)reply.summary=reply.result.message;
    emit({type:'summary',requestId:input.requestId,text:reply.summary});
    return this.repository.finish(roomId,session.actor,reply);
   }catch(error){const reply:ChatReply={requestId:input.requestId,summary:'요청을 처리하지 못했어요.',clarification:null,error:error instanceof Error?error.message:'CHAT_FAILED'};return this.repository.finish(roomId,session.actor,reply);}
  })().finally(()=>this.inFlight.delete(key));
  this.inFlight.set(key,{fingerprint,promise});return promise;
 }
}
