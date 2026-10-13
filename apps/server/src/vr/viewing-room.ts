import {StudentConnections} from '../accounts/student-connections';
import {Room,type Client} from '@colyseus/core';
import {idSchema,vrPoseSchema,type VrPose} from '@coedit/contracts';
import type {SessionResolver,IssuedSession} from '../accounts/session-store';
import type {VrBakeService} from './bake-service';
import type {RoomCapacity} from '../rooms/capacity';
export function createViewingRoom(sessions:SessionResolver,bakes:VrBakeService,capacity:RoomCapacity,connections=new StudentConnections()){
 return class ViewingRoom extends Room{
  maxClients=64;private roomKey='';private snapshotId='';
  private members=new Map<string,string>();private avatarIds=new Map<string,string|null>();private poses=new Map<string,VrPose>();private lastTime=new Map<string,number>();private lastSequence=new Map<string,number>();
  onCreate(options:{roomKey:unknown;snapshotId:unknown}){
   this.roomKey=idSchema.parse(options.roomKey);this.snapshotId=idSchema.parse(options.snapshotId);
   this.onMessage('pose',(client,raw:unknown)=>{
    const parsed=vrPoseSchema.safeParse(raw),previous=this.lastSequence.get(client.sessionId),now=Date.now();
    if(!parsed.success||!this.members.has(client.sessionId)||previous!==undefined&&parsed.data.seq<=previous||now-(this.lastTime.get(client.sessionId)??0)<90)return;
    this.lastSequence.set(client.sessionId,parsed.data.seq);this.poses.set(client.sessionId,parsed.data);this.lastTime.set(client.sessionId,now);
   });
   this.onMessage('command',client=>client.send('result',{ok:false,code:'READ_ONLY'}));
   this.onMessage('pose-stop',client=>{this.poses.delete(client.sessionId);});
   this.clock.setInterval(()=>this.publish(),100);
  }
  private publish(){for(const [id,time] of this.lastTime)if(Date.now()-time>1000)this.poses.delete(id);this.broadcast('poses',{avatars:[...this.poses].map(([connectionId,pose])=>({...pose,connectionId,actor:this.members.get(connectionId)!,avatarId:this.avatarIds.get(connectionId)??null}))});}
  async onAuth(_client:Client,options:{token:unknown;roomKey:unknown;snapshotId:unknown}){
   if(options.roomKey!==this.roomKey||options.snapshotId!==this.snapshotId)throw Error('WRONG_SNAPSHOT');
   const authRevision=connections.revision;const identity=await sessions.read(options.token,options.roomKey);
   await bakes.environment(String(options.token),this.roomKey,this.snapshotId);return {...identity,authRevision,avatarId:await bakes.avatarFor(identity.actor,this.roomKey)};
  }
  onJoin(client:Client){if(!connections.current(client.auth.actor,client.auth.authRevision))throw Error('UNAUTHENTICATED');capacity.join(this.roomKey,client.sessionId,true);this.members.set(client.sessionId,(client.auth as IssuedSession).actor);this.avatarIds.set(client.sessionId,(client.auth as IssuedSession&{avatarId:string|null}).avatarId);connections.add(client.auth.actor,client.sessionId,client.auth.authRevision,()=>{this.onLeave(client);void client.leave(4003);});this.publish();}
  async onDrop(client:Client){if(!connections.current(client.auth.actor,client.auth.authRevision))return;this.poses.delete(client.sessionId);this.lastTime.delete(client.sessionId);this.publish();try{await this.allowReconnection(client,15);}catch{/* reserved seat is released onLeave */}}
  onReconnect(client:Client){if(!connections.current(client.auth.actor,client.auth.authRevision)){void client.leave(4003);return;}connections.add(client.auth.actor,client.sessionId,client.auth.authRevision,()=>{this.onLeave(client);void client.leave(4003);});this.publish();}
  onLeave(client:Client){connections.remove(client.auth.actor,client.sessionId);capacity.leave(this.roomKey,client.sessionId);this.members.delete(client.sessionId);this.lastSequence.delete(client.sessionId);this.avatarIds.delete(client.sessionId);this.poses.delete(client.sessionId);this.lastTime.delete(client.sessionId);this.publish();}
  onDispose(){for(const [connectionId,actor] of this.members){connections.remove(actor,connectionId);capacity.leave(this.roomKey,connectionId);}}
 };
}
