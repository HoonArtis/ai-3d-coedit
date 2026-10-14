import {serverEndpoint} from '../server-endpoint';
import {Client,type Room} from '@colyseus/sdk';
import {parseServerEvent,previewSchema,type Command,type CommandResult,type CommandTransport,type ServerEvent,type Lease,type PreviewEvent} from '@coedit/contracts';
import {chatUpdateSchema,type ChatUpdate,type ChatRequest} from '@coedit/contracts';
type Identity={token:string;actor:string;role:'student'|'teacher';roomKey:string;storage?:'postgres'|'memory'};
export class RoomTransport implements CommandTransport {
  readonly identity:Identity;
  locks:Record<string,Lease>={};
  private room:Room;
  private listeners=new Set<(event:ServerEvent)=>void>();
  private previews=new Set<(event:PreviewEvent)=>void>();
  private chats=new Set<(event:ChatUpdate)=>void>();
  private pending=new Map<string,{resolve:(r:CommandResult)=>void;timer:ReturnType<typeof setTimeout>}>();
  private heartbeat:ReturnType<typeof setInterval>;
  private closed=false;
  private onPageHide=()=>this.close();
  onDisconnect?:()=>void;
  constructor(room:Room,identity:Identity){
    this.room=room;this.identity=identity;
    room.onMessage('chat',(raw:unknown)=>{const parsed=chatUpdateSchema.safeParse(raw);if(parsed.success)this.chats.forEach(fn=>fn(parsed.data));});
    room.onMessage('event',(raw:unknown)=>{
      const event=parseServerEvent(raw);
      if(event.type==='locks')this.locks=event.locks;
      this.listeners.forEach(listener=>listener(event));
    });
    room.onMessage('result',({requestId,result}:{requestId:string;result:CommandResult})=>{
      const pending=this.pending.get(requestId);if(!pending)return;
      clearTimeout(pending.timer);this.pending.delete(requestId);
      if(result.ok)this.listeners.forEach(listener=>listener({type:'snapshot',snapshot:result.snapshot}));
      pending.resolve(result);
    });
    room.onMessage('preview',(raw:unknown)=>{const p=previewSchema.safeParse(raw);if(p.success)this.previews.forEach(fn=>fn(p.data));});
    room.onLeave(()=>{this.closed=true;window.removeEventListener('pagehide',this.onPageHide);clearInterval(this.heartbeat);for(const p of this.pending.values()){clearTimeout(p.timer);p.resolve({ok:false,code:'DISCONNECTED',message:'서버 연결이 끊겼어요.'});}this.pending.clear();this.onDisconnect?.();});
    this.heartbeat=setInterval(()=>room.send('heartbeat'),10000);
    window.addEventListener('pagehide',this.onPageHide);
  }
  subscribe(listener:(event:ServerEvent)=>void){this.listeners.add(listener);this.room.send('sync');return()=>{this.listeners.delete(listener);};}
  subscribePreview(listener:(event:PreviewEvent)=>void){this.previews.add(listener);return()=>{this.previews.delete(listener);};}
  subscribeChat(listener:(event:ChatUpdate)=>void){this.chats.add(listener);this.room.send('chat-history');return()=>{this.chats.delete(listener);};}
  chat(request:ChatRequest){if(this.closed)throw Error('연결이 끊겼어요.');this.room.send('chat',request);}
  cancelChat(requestId:string){if(!this.closed)this.room.send('chat-cancel',requestId);}
  submit(command:Command):Promise<CommandResult>{
    if(this.closed)return Promise.resolve({ok:false,code:'DISCONNECTED',message:'서버 연결이 끊겼어요.'});
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{this.pending.delete(command.requestId);resolve({ok:false,code:'TIMEOUT',message:'응답을 기다리는 중이에요. 연결을 확인해 주세요.'});},10000);
      this.pending.set(command.requestId,{resolve,timer});
      try{this.room.send('command',command);}catch{clearTimeout(timer);this.pending.delete(command.requestId);resolve({ok:false,code:'DISCONNECTED',message:'서버 연결이 끊겼어요.'});}
    });
  }
  preview(event:PreviewEvent){this.room.send('preview',event);}
  close(){if(this.closed)return;this.closed=true;clearInterval(this.heartbeat);window.removeEventListener('pagehide',this.onPageHide);void this.room.leave();}
}
export async function connectRoom():Promise<RoomTransport>{
  const endpoint=serverEndpoint;
  const key='coedit-local-identity';
  const account=localStorage.getItem('coedit-account-identity');
  let saved:Identity|null=null;try{saved=JSON.parse(account??localStorage.getItem(key)??'null');}catch{/* replace invalid local identity */}
  // Older class-code sessions omitted storage. Recover metadata from authenticated server.
  if(account&&saved&&saved.storage===undefined){
    const response=await fetch(endpoint+'/api/room-session',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+saved.token},body:JSON.stringify({roomKey:saved.roomKey})});
    if(!response.ok)throw Error('수업 로그인이 만료되었어요. 다시 입장해 주세요.');
    saved=await response.json() as Identity;localStorage.setItem('coedit-account-identity',JSON.stringify(saved));
  }
  for(let attempt=0;attempt<2;attempt++){
    if(!saved){
      const response=await fetch(endpoint+'/api/local-session',{method:'POST'});
      if(!response.ok)throw Error('체험 세션을 열 수 없어요.');
      saved=await response.json() as Identity;localStorage.setItem(key,JSON.stringify(saved));
    }
    try{
      const room=await new Client(endpoint).joinOrCreate('studio',{token:saved.token,roomKey:saved.roomKey});
      return new RoomTransport(room,saved);
    }catch(error){
      if(account){throw Error('수업 로그인이 만료되었어요. 다시 입장해 주세요.');}
      if(attempt||!(error instanceof Error)||!error.message.includes('UNAUTHENTICATED'))throw error;
      saved=null;localStorage.removeItem(key);
    }
  }
  throw Error('서버 연결에 실패했어요.');
}
