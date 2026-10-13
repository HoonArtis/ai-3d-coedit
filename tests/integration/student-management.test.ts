import {test,expect} from 'vitest';
import {Pool} from 'pg';
import {randomUUID,randomBytes} from 'node:crypto';
import {Client,type Room} from '@colyseus/sdk';
import {AccountService} from '../../apps/server/src/accounts/service';
import {ClassInvites} from '../../apps/server/src/accounts/class-invites';
import {PostgresRoomRepository} from '../../apps/server/src/storage/postgres-room';
import {startServer} from '../../apps/server/src/server';
test('teacher manages live students, preserves or removes their objects and frees seats without restoring old credentials',async()=>{
 const pool=new Pool({connectionString:'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'}),accounts=new AccountService(pool),repo=new PostgresRoomRepository(pool);await accounts.migrate();await repo.migrate();
 const teacher=await accounts.registerTeacher({username:'manage-'+randomUUID(),password:'test-password-1234'}),other=await accounts.registerTeacher({username:'other-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(teacher.token,{name:'management',roomCount:1}),issued=await accounts.issueStudents(teacher.token,c.id,3),roomId=c.rooms[0].id;
 const server=await startServer(0,false,{accounts,repository:repo}),rooms:Room[]=[];
 const api=(token:string,path='',body?:unknown)=>fetch(server.url+'/api/rooms/'+roomId+'/students'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const connect=async(token:string)=>{const room=await new Client(server.url).joinOrCreate('studio',{token,roomKey:roomId});room.onMessage('event',()=>{});rooms.push(room);room.onLeave(()=>{const i=rooms.indexOf(room);if(i>=0)rooms.splice(i,1);});return room;};
 const command=(room:Room,actor:string,ops:unknown[])=>new Promise<any>(resolve=>{const requestId=randomUUID();const off=room.onMessage('result',(r:any)=>{if(r.requestId===requestId){off();resolve(r.result);}});room.send('command',{actor,source:'gizmo',requestId,ops});});
 try{
  const first=await accounts.joinStudent({roomCode:issued[0].roomCode,issuedId:issued[0].issuedId}),second=await accounts.joinStudent({roomCode:issued[1].roomCode,issuedId:issued[1].issuedId});let r1=await connect(first.token);const r2=await connect(second.token);
  expect((await command(r1,first.actor,[{op:'place',id:'keep',assetId:'cube',position:[0,0,0]}])).ok).toBe(true);
  expect((await command(r2,second.actor,[{op:'place',id:'remove',assetId:'cube',position:[2,0,0]}])).ok).toBe(true);
  expect((await api(teacher.token)).status).toBe(200);
  expect((await api(first.token)).status).toBe(403);expect((await api(other.token)).status).toBe(403);
  const list=await (await api(teacher.token)).json();expect(list.seats.filter((s:any)=>s.online)).toHaveLength(2);
  for(let i=0;i<2;i++){const key=r1.reconnectionToken;await r1.leave(false);r1=await new Client(server.url).reconnect(key);r1.onMessage('event',()=>{});const current=r1;rooms.push(current);current.onLeave(()=>{const i=rooms.indexOf(current);if(i>=0)rooms.splice(i,1);});}
  const left1=new Promise<number>(resolve=>r1.onLeave(resolve));
  expect((await api(teacher.token,'/'+first.actor+'/manage',{action:'remove',deleteObjects:false})).status).toBe(200);expect(await Promise.race([left1,new Promise(resolve=>setTimeout(()=>resolve('not closed'),1000))])).toBe(4003);
  await expect(accounts.session(first.token)).rejects.toThrow('UNAUTHENTICATED');await expect(accounts.joinStudent({roomCode:issued[0].roomCode,issuedId:issued[0].issuedId})).rejects.toThrow();
  expect((await repo.load(roomId))!.snapshot.objects.keep).toBeDefined();
  expect((await api(teacher.token,'/'+second.actor+'/manage',{action:'remove',deleteObjects:true})).status).toBe(200);
  expect(Object.keys((await repo.load(roomId))!.snapshot.objects)).toEqual(['keep']);
  const invite=await new ClassInvites(accounts).get(teacher.token,c.id);const replacement=await new ClassInvites(accounts).claim({code:invite.code,roomKey:roomId,ordinal:1,resumeKey:randomBytes(32).toString('base64url')});expect(replacement.actor).not.toBe(first.actor);
  const third=await accounts.joinStudent({roomCode:issued[2].roomCode,issuedId:issued[2].issuedId}),r3=await connect(third.token),left3=new Promise<number>(resolve=>r3.onLeave(resolve));
  expect((await api(teacher.token,'/'+third.actor+'/manage',{action:'disconnect',deleteObjects:false})).status).toBe(200);expect(await left3).toBe(4003);
  await expect(accounts.session(third.token)).rejects.toThrow();expect((await accounts.joinStudent({roomCode:issued[2].roomCode,issuedId:issued[2].issuedId})).actor).toBe(third.actor);
 }finally{for(const room of [...rooms])await room.leave().catch(()=>{});await server.close();await pool.query('DELETE FROM coedit_rooms WHERE id=$1',[roomId]);await pool.query('DELETE FROM coedit_teachers WHERE id=ANY($1::text[])',[[teacher.actor,other.actor]]);await pool.end();}
},30000);
