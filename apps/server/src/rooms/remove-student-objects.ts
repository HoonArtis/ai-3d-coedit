import {Client} from '@colyseus/sdk';
import {randomUUID} from 'node:crypto';
import type {CommandResult,Lease,Op} from '@coedit/contracts';
/** Use the authoritative room's ordinary teacher command path, including history and locks. */
export async function removeStudentObjects(endpoint:string,token:string,roomKey:string,teacher:string,student:string){
 const room=await new Client(endpoint).joinOrCreate('studio',{token,roomKey});
 let locks:Record<string,Lease>={};
 try{
  room.onMessage('event',event=>{if(event.type==='locks')locks=event.locks;});
  let ids:string[]=[];
  const submit=(ops:Op[])=>new Promise<Extract<CommandResult,{ok:true}>>((resolve,reject)=>{const requestId=randomUUID();const timer=setTimeout(()=>{off();reject(Error('ROOM_TIMEOUT'));},15000);const off=room.onMessage('result',(message:{requestId:string;result:CommandResult})=>{if(message.requestId!==requestId)return;clearTimeout(timer);off();message.result.ok?resolve(message.result):reject(Error(message.result.code));});room.send('command',{actor:teacher,source:'teacher',requestId,ops,lockTokens:Object.fromEntries(ids.filter(id=>locks[id]).map(id=>[id,locks[id].token]))});});
  // A normal read command drains earlier durable commits before selecting targets.
  const {snapshot}=await submit([{op:'list'}]);
  ids=Object.values(snapshot.objects).filter(o=>o.owner===student).map(o=>o.id);if(!ids.length)return 0;
  await submit([{op:'force_unlock',ids}]);await submit([{op:'lock',ids}]);await submit(ids.map(id=>({op:'delete' as const,id})));return ids.length;
 }finally{await room.leave();}
}
