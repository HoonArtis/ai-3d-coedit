import {test,expect} from 'vitest';
import {Client} from '@colyseus/sdk';
import type {RoomRepository,StoredRoom} from '../../apps/server/src/storage/room-repository';
import {startServer} from '../../apps/server/src/server';
import {removeStudentObjects} from '../../apps/server/src/rooms/remove-student-objects';
test('student object removal waits for an outstanding durable commit before selecting targets',async()=>{
 let state:StoredRoom|null=null,release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);
 const repository:RoomRepository={create:async s=>{state??=structuredClone(s);},load:async()=>structuredClone(state),lookup:async()=>null,commit:async(_seq,s)=>{if(s.snapshot.seq===1){entered();await gate;}state=structuredClone(s);}};
 const server=await startServer(0,false,{repository});
 const teacher=server.sessions.issue({actor:'teacher',role:'teacher',roomKey:'race'}),student=server.sessions.issue({actor:'student',role:'student',roomKey:'race'});
 const observer=await new Client(server.url).joinOrCreate('studio',{token:teacher,roomKey:'race'}),pupil=await new Client(server.url).joinOrCreate('studio',{token:student,roomKey:'race'});
 observer.onMessage('event',()=>{});pupil.onMessage('event',()=>{});pupil.onMessage('result',()=>{});
 try{
  pupil.send('command',{actor:'student',source:'gizmo',requestId:'late',ops:[{op:'place',id:'late-object',assetId:'cube',position:[0,0,0]}]});await started;await pupil.leave();
  const removal=removeStudentObjects(server.url,teacher,'race','teacher','student');
  // Keep the commit outstanding long enough for the helper's initial sync response.
  await new Promise(resolve=>setTimeout(resolve,150));release();expect(await removal).toBe(1);expect(Object.keys((await repository.load('race'))!.snapshot.objects)).toEqual([]);
 }finally{release();await observer.leave();await server.close();}
});
