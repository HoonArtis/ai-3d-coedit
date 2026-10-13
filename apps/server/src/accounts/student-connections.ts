/** Per-server live editor/VR connections. Revisions reject auth/reconnect races during removal. */
export class StudentConnections{
 revision=0;
 private changed=new Map<string,number>();private blocked=new Set<string>();
 private members=new Map<string,Map<string,()=>void>>();
 current(actor:string,revision:number){return !this.blocked.has(actor)&&(this.changed.get(actor)??0)<=revision;}
 add(actor:string,id:string,revision:number,close:()=>void){
  if(!this.current(actor,revision))throw Error('UNAUTHENTICATED');
  const group=this.members.get(actor)??new Map();group.set(id,close);this.members.set(actor,group);
 }
 remove(actor:string,id:string){const group=this.members.get(actor);group?.delete(id);if(!group?.size)this.members.delete(actor);}
 online(actor:string){return Boolean(this.members.get(actor)?.size);}
 suspend(actor:string){
  this.blocked.add(actor);this.changed.set(actor,++this.revision);
  const callbacks=[...(this.members.get(actor)?.values()??[])];this.members.delete(actor);
  for(const close of callbacks)close();
  return ()=>{this.changed.set(actor,++this.revision);this.blocked.delete(actor);};
 }
}
