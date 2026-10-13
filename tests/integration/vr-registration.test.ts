import {test,expect,beforeAll,afterAll} from 'vitest';import {Pool} from 'pg';import {randomUUID} from 'node:crypto';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {BUILTIN_LIBRARY,vrSourceSchema} from '@coedit/contracts';import {LocalObjectStore} from '@coedit/artifacts';import {JobQueues} from '@coedit/jobs';import {AccountService} from '../../apps/server/src/accounts/service';import {PostgresRoomRepository} from '../../apps/server/src/storage/postgres-room';import {SubmissionService} from '../../apps/server/src/storage/submissions';import {RoomService} from '../../apps/server/src/rooms/room-service';import {DurableRoom} from '../../apps/server/src/rooms/durable-room';import {VrBakeService} from '../../apps/server/src/vr/bake-service';
import {bakeVrJob} from '../../apps/workers/src/vr/job';
import {startServer} from '../../apps/server/src/server';
import {Client,type Room} from '@colyseus/sdk';
const connectionString='postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit',schema='vr_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString}),pool=new Pool({connectionString,options:'-c search_path='+schema}),accounts=new AccountService(pool),rooms=new PostgresRoomRepository(pool),queues=new JobQueues({prefix:'vr-test-'+randomUUID()});let directory:string,store:LocalObjectStore,submissions:SubmissionService,vr:VrBakeService;
beforeAll(async()=>{await admin.query('CREATE SCHEMA '+schema);await accounts.migrate();await rooms.migrate();await queues.ready();directory=await mkdtemp(join(tmpdir(),'coedit-vr-'));store=new LocalObjectStore(directory);submissions=new SubmissionService(pool,rooms,store);await submissions.migrate();vr=new VrBakeService(accounts,submissions,queues,store,{catalogForRoom:async()=>({})});await vr.migrate();});afterAll(async()=>{await queues.close();await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();await rm(directory,{recursive:true,force:true});});
test('duplicate submit and bake bind immutable snapshot and library across later edits and restart',async()=>{
 const teacher=await accounts.registerTeacher({username:'vr-'+randomUUID(),password:'test-password-1234'}),other=await accounts.registerTeacher({username:'other-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(teacher.token,{name:'vr',roomCount:1}),[s]=await accounts.issueStudents(teacher.token,c.id,1),identity=await accounts.joinStudent({roomCode:s.roomCode,issuedId:s.issuedId});
 const room=new RoomService(s.roomKey,BUILTIN_LIBRARY),durable=await DurableRoom.open(room,rooms);room.join('s',{actor:s.actor,role:'student'});
 const command=(id:string)=>({actor:s.actor,source:'gizmo',requestId:id,ops:[{op:'place',id,assetId:'cube',position:[0,0,0]}]});await durable.submit('s',command('one'));
 const submitted=await Promise.all(Array.from({length:5},()=>vr.submit(identity.token,s.roomKey,'submit-once')));expect(new Set(submitted.map(s=>s.id)).size).toBe(1);expect(submitted[0].seq).toBe(1);
 await durable.submit('s',command('two'));expect((await vr.submit(identity.token,s.roomKey,'submit-once')).seq).toBe(1);
 const baked=await Promise.all(Array.from({length:5},()=>vr.register(identity.token,s.roomKey,submitted[0].id)));expect(new Set(baked.map(b=>b.sourceKey)).size).toBe(1);
 const source=vrSourceSchema.parse(JSON.parse(new TextDecoder().decode(await store.get(baked[0].sourceKey))));expect(Object.keys(source.snapshot.objects)).toEqual(['one']);expect(Object.keys(source.library)).toEqual(['cube']);expect(source.snapshot.seq).toBe(1);
 await expect(vr.register(other.token,s.roomKey,submitted[0].id)).rejects.toThrow('FORBIDDEN');await expect(vr.register(identity.token,s.roomKey,'missing')).rejects.toThrow('NOT_FOUND');
 vr=new VrBakeService(accounts,submissions,queues,store,{catalogForRoom:async()=>({})});let jobs=0;const worker=queues.worker('cpu',async input=>{jobs++;expect(input.stage).toBe('vr-bake');expect(input.jobId).toBe(submitted[0].id);expect(input.payload.sourceKey).toBe(baked[0].sourceKey);return {deliberatelyIncomplete:true};});
 try{for(let i=0;i<100&&jobs===0;i++){await vr.enqueuePending();await new Promise(r=>setTimeout(r,20));}expect(jobs).toBe(1);await worker.close();await vr.enqueuePending();expect(jobs).toBe(1);expect((await vr.list(identity.token,s.roomKey))[0]).toMatchObject({snapshotId:submitted[0].id,state:'failed',manifestId:null,error:'INVALID_VR_RESULT'});}finally{await worker.close();}
});
test('authenticated HTTP submission publishes only completed worker artifacts',async()=>{
 const teacher=await accounts.registerTeacher({username:'http-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(teacher.token,{name:'http',roomCount:1}),[s]=await accounts.issueStudents(teacher.token,c.id,1),identity=await accounts.joinStudent({roomCode:s.roomCode,issuedId:s.issuedId});
 const room=new RoomService(s.roomKey,BUILTIN_LIBRARY),durable=await DurableRoom.open(room,rooms);room.join('s',{actor:s.actor,role:'student'});await durable.submit('s',{actor:s.actor,source:'gizmo',requestId:'place-http',ops:[{op:'place',id:'one',assetId:'cube',position:[1,0,2]}]});
 const server=await startServer(0,false,{accounts,vr}),headers={Authorization:`Bearer ${identity.token}`,'Content-Type':'application/json'};
 let worker:ReturnType<JobQueues['worker']>|undefined;const connections:Room[]=[];
 try{
  const base=server.url+'/api/rooms/'+s.roomKey+'/vr';
  const response=await fetch(base,{method:'POST',headers,body:JSON.stringify({requestId:'submit-http'})});expect(response.status).toBe(200);const submitted=await response.json();
  expect((await fetch(base+'/'+submitted.snapshotId+'/glb',{headers})).status).toBe(409);
  worker=queues.worker('cpu',input=>bakeVrJob(store,input));
  let list:any[]=[];for(let i=0;i<100;i++){await vr.enqueuePending();list=await (await fetch(base,{headers})).json();if(list[0]?.state==='ready')break;await new Promise(r=>setTimeout(r,30));}
  expect(list[0]).toMatchObject({state:'ready',seq:1});
  const environment=await(await fetch(base+'/'+submitted.snapshotId,{headers})).json();expect(environment.obstacles).toEqual([{min:[.5,0,1.5],max:[1.5,1,2.5]}]);expect(environment.spawn).toEqual([0,0,0]);
  const output=await fetch(base+'/'+submitted.snapshotId+'/glb',{headers});expect(output.status).toBe(200);expect(output.headers.get('content-type')).toContain('model/gltf-binary');expect((await output.arrayBuffer()).byteLength).toBeGreaterThan(100);
  expect((await fetch(base+'/'+submitted.snapshotId+'/glb')).status).toBe(401);
  const client=new Client(server.url),options={token:identity.token,roomKey:s.roomKey};
  const simultaneous=await Promise.all([client.joinOrCreate('viewing',{...options,snapshotId:submitted.snapshotId}),client.joinOrCreate('viewing',{...options,snapshotId:submitted.snapshotId})]);
  try{expect(simultaneous[0].roomId).toBe(simultaneous[1].roomId);const received:any[]=[];for(const room of simultaneous)room.onMessage('poses',p=>received.push(p));simultaneous[0].send('pose',{seq:1,head:{position:[0,1.6,0],quaternion:[0,0,0,1]},left:null,right:null});for(let i=0;i<40&&!received.some(p=>p.avatars.length);i++)await new Promise(r=>setTimeout(r,25));expect(received.some(p=>p.avatars.length===1)).toBe(true);}finally{await Promise.all(simultaneous.map(room=>room.leave()));}
  for(let i=0;i<4;i++){const editor=await client.joinOrCreate('studio',options);editor.onMessage('*',()=>{});connections.push(editor);}
  const viewer=await client.joinOrCreate('viewing',{...options,snapshotId:submitted.snapshotId});connections.push(viewer);const packets:any[]=[];viewer.onMessage('poses',p=>packets.push(p));viewer.onMessage('error',()=>{});
  await expect(client.joinOrCreate('viewing',{...options,snapshotId:submitted.snapshotId})).rejects.toThrow('ROOM_FULL');
  const outside=await client.joinOrCreate('studio',{token:teacher.token,roomKey:s.roomKey});outside.onMessage('*',()=>{});connections.push(outside);
  const pose={seq:1,head:{position:[0,1.6,0],quaternion:[0,0,0,1]},left:null,right:null};viewer.send('pose',{...pose,actor:'forged'});await new Promise(r=>setTimeout(r,120));expect(packets.flatMap(p=>p.avatars)).toHaveLength(0);
  viewer.send('pose',pose);for(let i=0;i<30&&!packets.some(p=>p.avatars.length);i++)await new Promise(r=>setTimeout(r,20));expect(packets.at(-1).avatars[0]).toMatchObject({actor:identity.actor,head:pose.head,left:null,right:null});
  const denied=new Promise<any>(resolve=>viewer.onMessage('result',resolve));viewer.send('command',{ops:[{op:'delete',id:'one'}]});expect(await denied).toMatchObject({ok:false,code:'READ_ONLY'});
  await connections.shift()!.leave();
  const second=await client.joinOrCreate('viewing',{...options,snapshotId:submitted.snapshotId});connections.push(second);second.onMessage('poses',()=>{});second.send('pose',{...pose,head:{...pose.head,position:[2,1.7,0]}});
  viewer.send('pose',{...pose,seq:2});for(let i=0;i<30&&packets.at(-1)?.avatars.length!==2;i++)await new Promise(r=>setTimeout(r,20));expect(packets.at(-1).avatars).toHaveLength(2);
  const reconnectToken=second.reconnectionToken;await second.leave(false);
  for(let i=0;i<30&&packets.at(-1)?.avatars.length!==1;i++)await new Promise(r=>setTimeout(r,20));expect(packets.at(-1).avatars).toHaveLength(1);
  await expect(client.joinOrCreate('viewing',{...options,snapshotId:submitted.snapshotId})).rejects.toThrow('ROOM_FULL');
  const reconnected=await client.reconnect(reconnectToken);reconnected.onMessage('poses',()=>{});connections[connections.indexOf(second)]=reconnected;
  viewer.send('pose-stop');for(let i=0;i<30&&packets.at(-1)?.avatars.length;i++)await new Promise(r=>setTimeout(r,20));expect(packets.at(-1).avatars).toHaveLength(0);
  await new Promise(r=>setTimeout(r,120));viewer.send('pose',pose);await new Promise(r=>setTimeout(r,180));expect(packets.at(-1).avatars).toHaveLength(0);
  viewer.send('pose',{...pose,seq:3});await new Promise(r=>setTimeout(r,180));expect(packets.at(-1).avatars[0]?.seq).toBe(3);
 }finally{await Promise.all(connections.map(room=>room.leave()));await worker?.close();await server.close();}
},120000);
