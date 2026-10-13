import {test,expect,beforeAll,afterAll} from 'vitest';import {Pool} from 'pg';import {randomUUID} from 'node:crypto';
import {BUILTIN_LIBRARY} from '@coedit/contracts';import {AccountService} from '../../apps/server/src/accounts/service';import {PostgresRoomRepository} from '../../apps/server/src/storage/postgres-room';import {RoomService} from '../../apps/server/src/rooms/room-service';import {DurableRoom} from '../../apps/server/src/rooms/durable-room';import {RoomHistoryService} from '../../apps/server/src/storage/room-history';
const connectionString='postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit',schema='restore_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString}),pool=new Pool({connectionString,options:'-c search_path='+schema}),accounts=new AccountService(pool),repo=new PostgresRoomRepository(pool);
beforeAll(async()=>{await admin.query('CREATE SCHEMA '+schema);await accounts.migrate();await repo.migrate();});afterAll(async()=>{await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();});
test('teacher history pagination and durable restore are scoped, atomic and restart safe',async()=>{
 const teacher=await accounts.registerTeacher({username:'t-'+randomUUID(),password:'test-password-1234'}),other=await accounts.registerTeacher({username:'o-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(teacher.token,{name:'history',roomCount:1}),[student]=await accounts.issueStudents(teacher.token,c.id,1),login=await accounts.joinStudent({roomCode:student.roomCode,issuedId:student.issuedId});
 const history=new RoomHistoryService(pool,accounts),room=new RoomService(c.rooms[0].id,BUILTIN_LIBRARY),durable=await DurableRoom.open(room,repo,history);room.join('s',{actor:student.actor,role:'student'});room.join('t',{actor:teacher.actor,role:'teacher'});
 let n=0;const send=(client:string,ops:unknown[])=>durable.submit(client,{actor:client==='s'?student.actor:teacher.actor,source:client==='s'?'chat':'teacher',requestId:'r'+(++n),ops});
 expect((await send('s',[{op:'place',id:'a',assetId:'cube',position:[0,0,0]}])).ok).toBe(true);await send('s',[{op:'move',id:'a',value:[2,0,0]}]);await send('s',[{op:'rename',id:'a',name:'changed'}]);
 const first=await history.list(teacher.token,room.snapshot.roomId,{objectId:'a',limit:2});expect(first.entries.map(e=>e.seq)).toEqual([3,2]);expect(first.entries[0].before?.name).toBe(BUILTIN_LIBRARY.cube.name);expect(first.entries[0].after?.name).toBe('changed');expect(first.nextCursor).toBe(2);
 await send('s',[{op:'move',id:'a',value:[3,0,0]}]);const second=await history.list(teacher.token,room.snapshot.roomId,{objectId:'a',before:first.nextCursor!,limit:2});expect(second.entries.map(e=>e.seq)).toEqual([1]);expect(second.nextCursor).toBeNull();
 await expect(history.list(other.token,room.snapshot.roomId,{})).rejects.toThrow('FORBIDDEN');await expect(history.list(login.token,room.snapshot.roomId,{})).rejects.toThrow('FORBIDDEN');
 expect((await send('t',[{op:'restore_object',id:'a',revision:1}])).ok).toBe(true);expect(room.snapshot.objects.a.position).toEqual([0,0,0]);expect(room.snapshot.objects.a.owner).toBe(student.actor);
 const restart=new RoomService(room.snapshot.roomId,BUILTIN_LIBRARY),reopened=await DurableRoom.open(restart,repo,history);restart.join('s',{actor:student.actor,role:'student'});restart.join('t',{actor:teacher.actor,role:'teacher'});
 expect(await reopened.submit('s',{actor:student.actor,source:'gizmo',requestId:'redo',ops:[{op:'redo'}]})).toMatchObject({ok:false,code:'HISTORY_EMPTY'});
 const restore={actor:teacher.actor,source:'teacher',requestId:'whole',ops:[{op:'restore_snapshot',snapshotId:'seq-0'}]};expect(await reopened.submit('t',restore)).toMatchObject({ok:true,snapshot:{seq:6,generation:1,objects:{}}});expect(await reopened.submit('t',restore)).toMatchObject({ok:true,snapshot:{seq:6,generation:1}});
 expect((await repo.load(room.snapshot.roomId))?.snapshot.generation).toBe(1);
 const state=restart.exportState();expect(await reopened.submit('t',{...restore,requestId:'bad',ops:[{op:'restore_object',id:'missing',revision:1}]})).toMatchObject({ok:false,code:'REVISION_NOT_FOUND'});expect(restart.exportState()).toEqual(state);
});

test('failed restoration persistence retains generation and leases; retry commits exactly once',async()=>{
 const id=randomUUID(),service=new RoomService(id,BUILTIN_LIBRARY);let fail=false;
 const repository={create:repo.create.bind(repo),load:repo.load.bind(repo),lookup:repo.lookup.bind(repo),commit:async(...args:Parameters<typeof repo.commit>)=>{if(fail)throw Error('offline');return repo.commit(...args);}};
 const history=new RoomHistoryService(pool,accounts),durable=await DurableRoom.open(service,repository,history);service.join('t',{actor:'teacher',role:'teacher'});
 const send=(ops:unknown[],requestId:string)=>durable.submit('t',{actor:'teacher',source:'teacher',requestId,ops});
 await send([{op:'place',id:'a',assetId:'cube',position:[0,0,0]}],'place');await send([{op:'lock',ids:['a']}],'lock');const before=service.exportState(),locks=structuredClone(service.locks);fail=true;
 const restore=[{op:'restore_snapshot',snapshotId:'seq-0'}];expect(await send(restore,'restore')).toMatchObject({ok:false,code:'PERSISTENCE_ERROR'});expect(service.exportState()).toEqual(before);expect(service.locks).toEqual(locks);
 fail=false;expect(await send(restore,'restore')).toMatchObject({ok:true,snapshot:{seq:2,generation:1,objects:{}}});expect(service.locks).toEqual({});expect(await send(restore,'restore')).toMatchObject({ok:true,snapshot:{seq:2,generation:1}});
});
