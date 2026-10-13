import {randomUUID} from 'node:crypto';
import type {Lease,SceneSnapshot,Session} from '@coedit/contracts';
type Held=Lease&{clientId:string;expires:number};
export class LockService{
  private held=new Map<string,Held>();
  private now:()=>number;
  constructor(now=Date.now){this.now=now;}
  fork(){this.expire();const copy=new LockService(this.now);copy.held=structuredClone(this.held);return copy;}
  get public():Record<string,Lease>{
    return Object.fromEntries([...this.held].map(([id,{owner,token}])=>[id,{owner,token}]));
  }
  forClient(clientId:string):Record<string,Lease>{
    return Object.fromEntries([...this.held].filter(([,l])=>l.clientId===clientId).map(([id,l])=>[id,{owner:l.owner,token:l.token}]));
  }
  acquire(clientId:string,session:Session,ids:string[],snapshot:SceneSnapshot,allowMissing=false){
    this.expire();
    for(const id of ids){
      const object=Object.hasOwn(snapshot.objects,id)?snapshot.objects[id]:undefined;
      if(!object&&!allowMissing)throw Error('NOT_FOUND');
      if(session.role==='viewer'||(object&&session.role!=='teacher'&&object.owner!==session.actor))throw Error('FORBIDDEN');
      const lock=this.held.get(id);
      if(lock&&lock.clientId!==clientId)throw Error('LOCKED');
    }
    for(const id of ids){
      const old=this.held.get(id);
      this.held.set(id,{owner:session.actor,clientId,token:old?.token??randomUUID(),expires:this.now()+30000});
    }
  }
  release(clientId:string,ids:string[],force=false){
    for(const id of ids){const lock=this.held.get(id);if(lock&&(force||lock.clientId===clientId))this.held.delete(id);}
  }
  disconnect(clientId:string){this.release(clientId,[...this.held.keys()]);}
  heartbeat(clientId:string){this.expire();for(const l of this.held.values())if(l.clientId===clientId)l.expires=this.now()+30000;}
  expire(){for(const [id,l] of this.held)if(l.expires<=this.now())this.held.delete(id);}
}
