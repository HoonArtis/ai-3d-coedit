import {test,expect,afterAll} from 'vitest';
import {Pool} from 'pg';
import {randomUUID,randomBytes} from 'node:crypto';
import {AccountService} from '../../apps/server/src/accounts/service';
import {ClassInvites} from '../../apps/server/src/accounts/class-invites';
import {startServer} from '../../apps/server/src/server';
const pool=new Pool({connectionString:'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'}),accounts=new AccountService(pool),invites=new ClassInvites(accounts),teachers:string[]=[];
afterAll(async()=>{for(const id of teachers)await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[id]);await pool.end();});
const key=()=>randomBytes(32).toString('base64url');
test('common-code lobby atomically claims a seat, resumes only its browser and rejects cross-class/closed invitations',async()=>{
 await accounts.migrate();const teacher=await accounts.registerTeacher({username:'invite-'+randomUUID(),password:'test-password-1234'});teachers.push(teacher.actor);
 const classroom=await accounts.createClass(teacher.token,{name:'seats',roomCount:1}),other=await accounts.createClass(teacher.token,{name:'other',roomCount:1});
 const invitation=await invites.get(teacher.token,classroom.id);const lobby=await invites.lobby({code:invitation.code});expect(lobby.rooms[0].seats.filter(s=>!s.occupied)).toHaveLength(5);
 const resumeKey=key(),seat={code:invitation.code,roomKey:classroom.rooms[0].id,ordinal:3};
 const results=await Promise.allSettled([invites.claim({...seat,resumeKey}),invites.claim({...seat,resumeKey:key()})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const winning=results.find(r=>r.status==='fulfilled')! as PromiseFulfilledResult<Awaited<ReturnType<typeof invites.claim>>>;
 const winnerKey=results[0].status==='fulfilled'?resumeKey:null;
 // Separate deterministic seat verifies retry/resume independently of scheduler order.
 const fixedKey=key(),fixed=await invites.claim({...seat,ordinal:1,resumeKey:fixedKey});
 expect((await invites.claim({...seat,ordinal:1,resumeKey:fixedKey})).actor).toBe(fixed.actor);
 expect((await invites.resume({code:invitation.code,resumeKey:fixedKey})).actor).toBe(fixed.actor);
 await expect(invites.resume({code:invitation.code,resumeKey:key()})).rejects.toThrow('UNAUTHENTICATED');
 await expect(invites.claim({...seat,roomKey:other.rooms[0].id,resumeKey:key()})).rejects.toThrow('FORBIDDEN');
 await expect(invites.get(fixed.token,classroom.id)).rejects.toThrow('FORBIDDEN');
 const issued=await accounts.issueStudents(teacher.token,classroom.id,3);expect(issued.map(s=>s.ordinal)).toEqual([2,4,5]);
 expect((await invites.lobby({code:invitation.code})).rooms[0].seats.every(s=>s.occupied)).toBe(true);
 await invites.setEnabled(teacher.token,classroom.id,false);await expect(invites.lobby({code:invitation.code})).rejects.toThrow('INVITE_CLOSED');
 expect((await invites.resume({code:invitation.code,resumeKey:fixedKey})).actor).toBe(fixed.actor);
 expect(winning.value.role).toBe('student');void winnerKey;
});
test('lobby refresh requests do not spend the seat admission budget',async()=>{
 await accounts.migrate();const teacher=await accounts.registerTeacher({username:'poll-'+randomUUID(),password:'test-password-1234'});teachers.push(teacher.actor);
 const classroom=await accounts.createClass(teacher.token,{name:'polling',roomCount:1}),invite=await invites.get(teacher.token,classroom.id);
 const server=await startServer(0,false,{accounts,registrationEnabled:false});
 const post=(path:string,body:unknown)=>fetch(server.url+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  for(let n=0;n<125;n++)await post('/lobby',{code:invite.code});
  const claim=await post('/lobby/claim',{code:invite.code,roomKey:classroom.rooms[0].id,ordinal:1,resumeKey:key()});expect(claim.status).toBe(200);
 }finally{await server.close();}
});
test('invalid resume key cannot reserve an unusable seat',async()=>{
 await accounts.migrate();const teacher=await accounts.registerTeacher({username:'key-'+randomUUID(),password:'test-password-1234'});teachers.push(teacher.actor);
 const classroom=await accounts.createClass(teacher.token,{name:'key boundary',roomCount:1}),invite=await invites.get(teacher.token,classroom.id);
 await expect(invites.claim({code:invite.code,roomKey:classroom.rooms[0].id,ordinal:1,resumeKey:'a'.repeat(81)})).rejects.toThrow();
 expect((await invites.lobby({code:invite.code})).rooms[0].seats[0].occupied).toBe(false);
});
