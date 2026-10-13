import {test,expect,beforeAll,afterAll} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {AccountService} from '../../apps/server/src/accounts/service';
import {GenerationRepository} from '../../apps/server/src/generation/repository';
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});
const accounts=new AccountService(pool);const teachers:string[]=[];
beforeAll(()=>accounts.migrate());
afterAll(async()=>{for(const id of teachers)await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[id]);await pool.end();});
async function teacher(){const username='teacher-'+randomUUID();const result=await accounts.registerTeacher({username,password:'test-password-1234'});teachers.push(result.actor);return {...result,username};}
test('teacher auth persists, rejects password and refuses role overrides',async()=>{
  const t=await teacher();const login=await accounts.loginTeacher({username:t.username,password:'test-password-1234'});
  expect((await accounts.session(login.token)).role).toBe('teacher');
  await expect(accounts.loginTeacher({username:t.username,password:'bad'})).rejects.toThrow();
  await expect(accounts.registerTeacher({username:'forge',password:'test-password-1234',role:'student'})).rejects.toThrow();
  await accounts.logout(login.token);await expect(accounts.session(login.token)).rejects.toThrow('UNAUTHENTICATED');
});
test('class with six rooms issues 30 unique students and binds each to the right room',async()=>{
  const t=await teacher();const classroom=await accounts.createClass(t.token,{name:'공간 수업',roomCount:6});
  expect(classroom.rooms).toHaveLength(6);
  const students=await accounts.issueStudents(t.token,classroom.id,30);expect(new Set(students.map(s=>s.issuedId)).size).toBe(30);
  for(const room of classroom.rooms)expect(students.filter(s=>s.roomKey===room.id)).toHaveLength(5);
  const student=students[0];const joined=await accounts.joinStudent({roomCode:student.roomCode,issuedId:student.issuedId});
  expect(joined.actor).toBe(student.actor);expect(joined.role).toBe('student');
  const roomSession=await accounts.resolveRoomToken(joined.token,student.roomKey);expect(roomSession.actor).toBe(student.actor);
  const wrong=classroom.rooms.find(r=>r.id!==student.roomKey)!;
  await expect(accounts.joinStudent({roomCode:wrong.code,issuedId:student.issuedId})).rejects.toThrow('UNAUTHENTICATED');
  await expect(accounts.resolveRoomToken(joined.token,wrong.id)).rejects.toThrow('FORBIDDEN');
  await expect(accounts.createClass(joined.token,{name:'hijack',roomCount:1})).rejects.toThrow('FORBIDDEN');
  await pool.query("UPDATE coedit_account_sessions SET expires_at=now()-interval '1 second' WHERE actor=$1",[student.actor]);
  await expect(accounts.session(joined.token)).rejects.toThrow('UNAUTHENTICATED');
  const again=await accounts.joinStudent({roomCode:student.roomCode,issuedId:student.issuedId});expect(again.actor).toBe(student.actor);
});
test('other teachers cannot manage or join another class and issuance is all or nothing',async()=>{
  const t=await teacher(),other=await teacher();const c=await accounts.createClass(t.token,{name:'one',roomCount:1});
  await expect(accounts.addRoom(other.token,c.id,'侵入')).rejects.toThrow('FORBIDDEN');
  await expect(accounts.issueStudents(other.token,c.id,1)).rejects.toThrow('FORBIDDEN');
  await expect(accounts.resolveRoomToken(other.token,c.rooms[0].id)).rejects.toThrow('FORBIDDEN');
  await expect(accounts.issueStudents(t.token,c.id,6)).rejects.toThrow('CAPACITY');
  expect((await pool.query('SELECT count(*)::int AS n FROM coedit_students WHERE room_id=$1',[c.rooms[0].id])).rows[0].n).toBe(0);
});

test('mid-batch database failure rolls back all generated student accounts',async()=>{
  const t=await teacher(),c=await accounts.createClass(t.token,{name:'rollback',roomCount:1});
  const collision=new AccountService(pool,()=> 'same-credential-for-collision');
  await expect(collision.issueStudents(t.token,c.id,5)).rejects.toThrow();
  expect((await pool.query('SELECT count(*)::int AS n FROM coedit_students WHERE room_id=$1',[c.rooms[0].id])).rows[0].n).toBe(0);
});
test('teacher quota changes are class-scoped, validated, and read by generation reservation',async()=>{
 const t=await teacher(),other=await teacher(),c=await accounts.createClass(t.token,{name:'quota',roomCount:1}),[s]=await accounts.issueStudents(t.token,c.id,1),student=await accounts.joinStudent({roomCode:s.roomCode,issuedId:s.issuedId});
 for(const value of [-1,1.5,NaN,1001])await expect(accounts.setGenerationLimit(t.token,c.id,value)).rejects.toThrow();
 await expect(accounts.setGenerationLimit(other.token,c.id,10)).rejects.toThrow('FORBIDDEN');await expect(accounts.setGenerationLimit(student.token,c.id,10)).rejects.toThrow('FORBIDDEN');
 const repo=new GenerationRepository(pool);await repo.migrate();await accounts.setGenerationLimit(t.token,c.id,0);
 const scope={...s,role:'student' as const},request={requestId:randomUUID(),source:{kind:'upload',imageKey:'a'.repeat(64)}};
 await expect(repo.reserve(scope,0,request)).rejects.toThrow('GENERATION_LIMIT');await accounts.setGenerationLimit(t.token,c.id,1);await repo.reserve(scope,0,request);expect(await repo.usage(scope)).toEqual({used:1,limit:1});
 await accounts.setGenerationLimit(t.token,c.id,0);expect(await repo.usage(scope)).toEqual({used:1,limit:0});
});
