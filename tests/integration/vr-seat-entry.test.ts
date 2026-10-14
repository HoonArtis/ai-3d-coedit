import {test,expect,beforeAll,afterAll} from 'vitest';
import {Pool} from 'pg';import {randomUUID} from 'node:crypto';
import {AccountService} from '../../apps/server/src/accounts/service';
import {ClassInvites} from '../../apps/server/src/accounts/class-invites';
const connectionString='postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit',schema='vrseat_test_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString}),pool=new Pool({connectionString,options:'-c search_path='+schema}),accounts=new AccountService(pool),invites=new ClassInvites(accounts);
beforeAll(async()=>{await admin.query('CREATE SCHEMA '+schema);await accounts.migrate();});
afterAll(async()=>{await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();});
test('any occupied seat can be used for VR with a class code, without granting editing rights',async()=>{
 const teacher=await accounts.registerTeacher({username:'vr-seat-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(teacher.token,{name:'VR seats',roomCount:2}),students=await accounts.issueStudents(teacher.token,c.id,3),invite=await invites.get(teacher.token,c.id);
 for(const student of students){
  const viewer=await invites.view({code:invite.code,roomKey:student.roomKey,ordinal:student.ordinal});expect(viewer).toMatchObject({actor:student.actor,viewOnly:true});
  expect(await accounts.resolveRoomToken(viewer.token,student.roomKey,true)).toMatchObject({actor:student.actor});
  await expect(accounts.resolveRoomToken(viewer.token,student.roomKey)).rejects.toThrow('FORBIDDEN');
  await expect(accounts.resolveRoomToken(viewer.token,c.rooms[1].id,true)).rejects.toThrow('FORBIDDEN');
 }
 const foreign=await accounts.createClass(teacher.token,{name:'other',roomCount:1});
 await expect(invites.view({code:invite.code,roomKey:foreign.rooms[0].id,ordinal:1})).rejects.toThrow('FORBIDDEN');
 const guest=await invites.view({code:invite.code,roomKey:students[0].roomKey,ordinal:5});expect(guest.viewOnly).toBe(true);
 expect(await accounts.resolveRoomToken(guest.token,guest.roomKey,true)).toMatchObject({actor:guest.actor});
 await expect(accounts.resolveRoomToken(guest.token,guest.roomKey)).rejects.toThrow('FORBIDDEN');
 await expect(accounts.resolveRoomToken(guest.token,c.rooms[1].id,true)).rejects.toThrow('FORBIDDEN');
 expect((await invites.lobby({code:invite.code})).rooms[0].seats[4].occupied).toBe(false);
 await invites.setEnabled(teacher.token,c.id,false);await expect(invites.view({code:invite.code,roomKey:students[0].roomKey,ordinal:1})).rejects.toThrow('INVITE_CLOSED');
});
