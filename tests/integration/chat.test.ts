import {it,expect,beforeAll,afterAll} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {ChatRepository} from '../../apps/server/src/chat/repository';
import {ChatService} from '../../apps/server/src/chat/service';
import {JobQueues} from '../../packages/jobs/src/index';
import {RoomService} from '../../apps/server/src/rooms/room-service';
import {BUILTIN_LIBRARY} from '../../packages/contracts/src/index';
const pool=new Pool({connectionString:'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'}),repo=new ChatRepository(pool);
const roomIds:string[]=[];beforeAll(()=>repo.migrate());afterAll(async()=>{for(const id of roomIds)await pool.query('DELETE FROM coedit_chat_requests WHERE room_id=$1',[id]);await pool.end();});
it('binds chat to authenticated actor, submits one atomic command and persists refusals',async()=>{
 const roomId=randomUUID();roomIds.push(roomId);const room=new RoomService(roomId,BUILTIN_LIBRARY);room.join('a',{actor:'alice',role:'student'});room.join('b',{actor:'bob',role:'student'});
 room.submit('b',{actor:'bob',source:'gizmo',requestId:'bobplace',ops:[{op:'place',id:'bobobj',assetId:'table',position:[0,0,0]}]});
 const queue=new JobQueues({prefix:'chat-test-'+randomUUID()});await queue.ready();let runs=0;
 const worker=queue.worker('llm',async job=>{runs++;return job.jobId==='attack'?{summary:'삭제',clarification:null,ops:[{op:'place',id:'partial',assetId:'chair',position:[0,0,0]},{op:'delete',id:'bobobj'}]}:{summary:'탁자와 의자 배치',clarification:null,ops:[{op:'place',id:'t1',assetId:'table',position:[5,0,0]},{op:'arrange_around',targetId:'t1',assetId:'chair',ids:['c1','c2','c3','c4'],radius:2}]};});
 const chat=new ChatService(repo,queue),events:unknown[]=[];
 const request={requestId:'one',message:'탁자 주위 의자 4개',selectedId:null,cameraCenter:[0,0,0]};
 const invoke=(raw:unknown)=>chat.request(room,'a',raw,c=>Promise.resolve(room.submit('a',c)),e=>events.push(e));
 try{
  await expect(invoke({...request,actor:'bob'})).rejects.toThrow();
  const first=await invoke(request);expect(first.result?.ok).toBe(true);expect(room.snapshot.seq).toBe(2);expect(Object.keys(room.snapshot.objects)).toHaveLength(6);
  await invoke(request);expect(runs).toBe(1);expect(room.snapshot.seq).toBe(2);
  const attack=await invoke({...request,requestId:'attack',message:'다른 학생 물체 삭제'});expect(attack).toMatchObject({result:{ok:false}});expect(room.snapshot.objects.partial).toBeUndefined();
  expect((await repo.history(roomId,'alice')).map(x=>x.requestId)).toEqual(['one','attack']);expect(await repo.history(roomId,'bob')).toEqual([]);
  expect(events.some((e:any)=>e.type==='summary')).toBe(true);
  const undo=room.submit('a',{actor:'alice',source:'chat',requestId:'undo',ops:[{op:'undo'}]});expect(undo.ok).toBe(true);expect(Object.keys(room.snapshot.objects)).toEqual(['bobobj']);
 }finally{await worker.close();await queue.close();}
});
it('logs malformed model output and gives one clarification without applying scene changes',async()=>{
 const roomId=randomUUID();roomIds.push(roomId);const room=new RoomService(roomId,BUILTIN_LIBRARY);room.join('a',{actor:'alice',role:'student'});
 const queue=new JobQueues({prefix:'chat-test-'+randomUUID()});await queue.ready();
 const worker=queue.worker('llm',async job=>job.jobId==='bad'?{summary:'hack',clarification:null,ops:[{op:'force_unlock',ids:['x']}]}:{summary:'대상을 선택해 주세요',clarification:'어느 것인가요?',ops:[]});
 const chat=new ChatService(repo,queue),invoke=(id:string)=>chat.request(room,'a',{requestId:id,message:'저거',selectedId:null,cameraCenter:[0,0,0]},c=>Promise.resolve(room.submit('a',c)),()=>{});
 try{expect(await invoke('question')).toMatchObject({clarification:'어느 것인가요?'});expect((await invoke('question2')).clarification).toBeNull();expect((await invoke('bad')).error).toBeTruthy();expect(room.snapshot.seq).toBe(0);expect(await repo.history(roomId,'alice')).toHaveLength(3);}
 finally{await worker.close();await queue.close();}
});
it('resumes a persisted pending request with its original model input after coordinator restart',async()=>{
 const roomId=randomUUID();roomIds.push(roomId);const room=new RoomService(roomId,BUILTIN_LIBRARY);room.join('a',{actor:'alice',role:'student'});
 const queue=new JobQueues({prefix:'chat-test-'+randomUUID()});await queue.ready();let runs=0;
 const worker=queue.worker('llm',async job=>{runs++;expect((job.payload.context as any).scene.seq).toBe(0);return {summary:'목록',clarification:null,ops:[{op:'list'}]};});
 const input={requestId:'restart',message:'목록',selectedId:null,cameraCenter:[0,0,0] as [number,number,number]};
 try{
  await repo.begin(roomId,'alice',input);
  await repo.jobInput(roomId,'alice',input.requestId,{jobId:input.requestId,inputVersion:1,actor:'alice',roomId,generation:0,stage:'llm',payload:{messages:[{role:'user',content:'목록'}],context:{actor:'alice',selectedId:null,cameraCenter:[0,0,0],scene:room.snapshot}}});
  room.submit('a',{actor:'alice',source:'gizmo',requestId:'new',ops:[{op:'place',id:'newobject',assetId:'chair',position:[0,0,0]}]});
  const chat=new ChatService(repo,queue);expect(await chat.pending(room,'a')).toEqual(input);
  expect((await chat.request(room,'a',input,c=>Promise.resolve(room.submit('a',c)),()=>{})).result?.ok).toBe(true);expect(runs).toBe(1);expect(await chat.pending(room,'a')).toBeNull();
 }finally{await worker.close();await queue.close();}
});
it('cancels pending application and handles 30 students without exceeding the LLM limit',async()=>{
 const queue=new JobQueues({prefix:'thirty-'+randomUUID(),llmConcurrency:2});await queue.ready();let active=0,maximum=0;
 let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
 const worker=queue.worker('llm',async job=>{active++;maximum=Math.max(maximum,active);if(job.jobId==='cancel')await gate;else await new Promise(r=>setTimeout(r,10));active--;return {summary:'배치',clarification:null,ops:[{op:'place',id:'placed',assetId:'chair',position:[0,0,0]}]};});
 const chat=new ChatService(repo,queue);
 const rooms=Array.from({length:30},()=>{const id=randomUUID();roomIds.push(id);const room=new RoomService(id,BUILTIN_LIBRARY);room.join('client',{actor:'student',role:'student'});return room;});
 const request=(room:RoomService,id:string)=>chat.request(room,'client',{requestId:id,message:'의자 배치',selectedId:null,cameraCenter:[0,0,0]},c=>Promise.resolve(room.submit('client',c)),()=>{});
 try{
  const cancelled=request(rooms[0],'cancel');await expect.poll(async()=>(await chat.pending(rooms[0],'client'))?.requestId).toBe('cancel');
  expect((await chat.cancel(rooms[0],'client','cancel')).error).toBe('CANCELLED');release();
  expect((await cancelled).error).toBe('CANCELLED');expect(rooms[0].snapshot.seq).toBe(0);
  const results=await Promise.all(rooms.map((room,i)=>request(room,'request'+i)));
  expect(results.every(r=>r.result?.ok)).toBe(true);expect(maximum).toBeLessThanOrEqual(2);expect(maximum).toBe(2);
  for(const room of rooms)expect((await repo.history(room.snapshot.roomId,'student')).some(r=>r.result?.ok)).toBe(true);
 }finally{release();await worker.close();await queue.close();}
},15000);

it('rejects a delayed model command if restore commits during the apply claim',async()=>{
 const roomId=randomUUID();roomIds.push(roomId);const room=new RoomService(roomId,BUILTIN_LIBRARY);room.join('a',{actor:'alice',role:'student'});
 class RacingRepository extends ChatRepository {override async claimApply(...args:Parameters<ChatRepository['claimApply']>){const claimed=await super.claimApply(...args);const state=room.exportState();state.snapshot.generation++;room.importState(state);return claimed;}}
 const queue=new JobQueues({prefix:'restore-race-'+randomUUID()});await queue.ready();const worker=queue.worker('llm',async()=>({summary:'place',clarification:null,ops:[{op:'place',id:'stale',assetId:'cube',position:[0,0,0]}]}));
 try{const reply=await new ChatService(new RacingRepository(pool),queue).request(room,'a',{requestId:'restore-race',message:'place',selectedId:null,cameraCenter:[0,0,0]},c=>Promise.resolve(room.submit('a',c)),()=>{});expect(reply.result).toMatchObject({ok:false,code:'SCENE_RESTORED'});expect(room.snapshot.objects.stale).toBeUndefined();}finally{await worker.close();await queue.close();}
});
