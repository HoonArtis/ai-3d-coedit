import {Room,type Client} from '@colyseus/core';
import {idSchema,vrPoseSchema,type VrPose} from '@coedit/contracts';
import type {SessionResolver,IssuedSession} from '../accounts/session-store';
import type {VrBakeService} from './bake-service';
import type {RoomCapacity} from '../rooms/capacity';
export function createViewingRoom(sessions:SessionResolver,bakes:VrBakeService,capacity:RoomCapacity){
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
   const identity=await sessions.read(options.token,options.roomKey);
   await bakes.environment(String(options.token),this.roomKey,this.snapshotId);return {...identity,avatarId:await bakes.avatarFor(identity.actor,this.roomKey)};
  }
  onJoin(client:Client){capacity.join(this.roomKey,client.sessionId,true);this.members.set(client.sessionId,(client.auth as IssuedSession).actor);this.avatarIds.set(client.sessionId,(client.auth as IssuedSession&{avatarId:string|null}).avatarId);this.publish();}
  async onDrop(client:Client){this.poses.delete(client.sessionId);this.lastTime.delete(client.sessionId);this.publish();try{await this.allowReconnection(client,15);}catch{/* reserved seat is released onLeave */}}
  onReconnect(){this.publish();}
  onLeave(client:Client){capacity.leave(this.roomKey,client.sessionId);this.members.delete(client.sessionId);this.lastSequence.delete(client.sessionId);this.avatarIds.delete(client.sessionId);this.poses.delete(client.sessionId);this.lastTime.delete(client.sessionId);this.publish();}
  onDispose(){for(const connectionId of this.members.keys())capacity.leave(this.roomKey,connectionId);}
 };
}
