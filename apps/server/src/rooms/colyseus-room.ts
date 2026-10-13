import {Room,type Client} from '@colyseus/core';
import {BUILTIN_LIBRARY,idSchema} from '@coedit/contracts';
import {RoomService} from './room-service';
import type {SessionResolver,IssuedSession} from '../accounts/session-store';
import type {RoomRepository} from '../storage/room-repository';
import {DurableRoom} from './durable-room';
import type {ChatService} from '../chat/service';
import type {ImageService} from '../generation/image-service';
import {generationCommand} from '../generation/command';
import type {AssetService} from '../assets/service';
import type {RoomHistoryService} from '../storage/room-history';
import {RoomCapacity} from './capacity';
import type {RetextureService} from '../generation/retexture-service';
export function createStudioRoom(sessions:SessionResolver,repository?:RoomRepository,localPreview=false,chat?:ChatService,images?:ImageService,assets?:AssetService,history?:RoomHistoryService,capacity=new RoomCapacity(),retexture?:RetextureService){
  return class StudioRoom extends Room {
    service!:RoomService;
    maxClients=64;
    async onCreate(options:{roomKey:string}){
      this.service=new RoomService(options.roomKey,BUILTIN_LIBRARY);
      let libraryFingerprint='';
      const refreshLibrary=async()=>{
        const library={...BUILTIN_LIBRARY,...await assets?.catalogForRoom(options.roomKey)},fingerprint=JSON.stringify(library);
        if(fingerprint!==libraryFingerprint){this.service.setLibrary(library);libraryFingerprint=fingerprint;this.broadcast('event',{type:'library',library});}
      };
      await refreshLibrary();
      const durable=repository&&!(localPreview&&options.roomKey==='local-room')?await DurableRoom.open(this.service,repository,history):undefined;
      let lastRestorationSeq=0;
      const submit=async(clientId:string,payload:unknown)=>{
        try{
          await refreshLibrary();const beforeSeq=this.service.snapshot.seq;
          const result=await generationCommand(this.service,clientId,payload,images,retexture)??(durable?await durable.submit(clientId,payload):this.service.submit(clientId,payload));
          if(result.ok){
            this.broadcast('event',{type:'snapshot',snapshot:this.service.snapshot});this.broadcast('event',{type:'locks',locks:this.service.locks});
            const command=payload as {requestId:string;ops:{op:string}[]};
            if(result.snapshot.seq>beforeSeq&&result.snapshot.seq>lastRestorationSeq&&command.ops.some(op=>op.op==='restore_object'||op.op==='restore_snapshot')){
              lastRestorationSeq=result.snapshot.seq;
              this.broadcast('event',{type:'restored',requestId:command.requestId,actor:this.service.getSession(clientId).actor,seq:result.snapshot.seq,generation:result.snapshot.generation,count:result.changedIds.length});
            }
          }
          return result;
        }
        catch{return {ok:false as const,code:'SERVICE_UNAVAILABLE',message:'라이브러리 상태를 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.'};}
      };
      this.onMessage('chat-history',async client=>{try{
        client.send('chat',{type:'history',records:chat?await chat.history(this.service,client.sessionId):[]});
        const pending=await chat?.pending(this.service,client.sessionId);if(pending)client.send('chat',{type:'resume',request:pending});
      }catch{client.send('event',{type:'error',code:'CHAT_HISTORY_FAILED',message:'대화 기록을 읽지 못했어요.'});}});
      this.onMessage('chat',async(client,payload:unknown)=>{
        const requestId=typeof payload==='object'&&payload!==null&&'requestId' in payload?String(payload.requestId):'invalid';
        try{
          if(!chat)throw Error('CHAT_UNAVAILABLE');
          const reply=await chat.request(this.service,client.sessionId,payload,
            command=>submit(client.sessionId,command),
            event=>client.send('chat',event));
          client.send('chat',{type:'reply',reply});
        }catch(error){client.send('chat',{type:'reply',reply:{requestId,summary:'요청을 처리하지 못했어요.',clarification:null,error:error instanceof Error?error.message:'CHAT_FAILED'}});}
      });
      this.onMessage('chat-cancel',async(client,raw:unknown)=>{
        try{if(!chat)throw Error('CHAT_UNAVAILABLE');const requestId=idSchema.parse(raw);const reply=await chat.cancel(this.service,client.sessionId,requestId);client.send('chat',{type:'reply',reply});}
        catch{client.send('event',{type:'error',code:'CHAT_CANCEL_FAILED',message:'이미 적용 중이거나 취소할 요청이 없어요.'});}
      });
      this.onMessage('command',async(client,payload:unknown)=>{
        const result=await submit(client.sessionId,payload);
        const requestId=typeof payload==='object'&&payload!==null&&'requestId' in payload?payload.requestId:null;
        client.send('result',{requestId,result});
      });
      this.onMessage('sync',client=>{client.send('event',{type:'library',library:this.service.getLibrary()});client.send('event',{type:'snapshot',snapshot:this.service.snapshot});client.send('event',{type:'locks',locks:this.service.locks});});
      this.clock.setInterval(()=>void refreshLibrary().catch(()=>{}),5000);
      this.onMessage('heartbeat',client=>this.service.heartbeat(client.sessionId));
      this.onMessage('preview',(client,event:unknown)=>{
        const valid=this.service.preview(client.sessionId,event);
        if(valid)this.broadcast('preview',valid,{except:client});
      });
      this.clock.setInterval(()=>{
        const previous=JSON.stringify(this.service.locks);this.service.expireLocks();
        if(previous!==JSON.stringify(this.service.locks))this.broadcast('event',{type:'locks',locks:this.service.locks});
      },1000);
    }
    onAuth(_client:Client,options:{token:unknown;roomKey:unknown}){return sessions.read(options.token,options.roomKey);}
    onJoin(client:Client){
      const identity=client.auth as IssuedSession;capacity.join(this.service.snapshot.roomId,client.sessionId,identity.role!=='teacher');
      try{this.service.join(client.sessionId,identity);}catch(error){capacity.leave(this.service.snapshot.roomId,client.sessionId);throw error;}
    }
    async onDrop(client:Client){
      this.service.drop(client.sessionId);
      this.broadcast('event',{type:'locks',locks:this.service.locks});
      try{await this.allowReconnection(client,15);}catch{/* onLeave releases the reserved membership */}
    }
    onReconnect(client:Client){client.send('event',{type:'snapshot',snapshot:this.service.snapshot});}
    onLeave(client:Client){capacity.leave(this.service.snapshot.roomId,client.sessionId);this.service.leave(client.sessionId);this.broadcast('event',{type:'locks',locks:this.service.locks});}
  };
}
