import {test,expect,beforeAll,afterAll} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {AccountService} from '../../apps/server/src/accounts/service';
import {GenerationRepository} from '../../apps/server/src/generation/repository';
import {validateGenerationPrompt} from '../../apps/server/src/generation/prompt-filter';
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'});
const accounts=new AccountService(pool),repository=new GenerationRepository(pool),teachers:string[]=[];
beforeAll(async()=>{await accounts.migrate();await repository.migrate();});
afterAll(async()=>{for(const id of teachers)await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[id]);await pool.end();});
async function fixture(limit=3){
 const teacher=await accounts.registerTeacher({username:'gen-'+randomUUID(),password:'test-password-1234'});teachers.push(teacher.actor);
 const classroom=await accounts.createClass(teacher.token,{name:'generation',roomCount:1});
 const [student,other]=await accounts.issueStudents(teacher.token,classroom.id,2);
 await pool.query('UPDATE coedit_classes SET generation_limit=$2 WHERE id=$1',[classroom.id,limit]);
 return {scope:{actor:student.actor,roomKey:student.roomKey,role:'student' as const},other:{actor:other.actor,roomKey:other.roomKey,role:'student' as const}};
}
const request=()=>({requestId:randomUUID(),source:{kind:'text' as const,prompt:'a blue whale bench'}});
test('last credit is reserved once across concurrent requests; duplicate ID is idempotent and failure refunds once',async()=>{
 const {scope}=await fixture(1),input=request();
 const same=await Promise.all(Array.from({length:8},()=>repository.reserve(scope,0,input)));
 expect(new Set(same.map(r=>r.id)).size).toBe(1);
 expect(await repository.usage(scope)).toEqual({used:1,limit:1});
 await expect(repository.reserve(scope,0,request())).rejects.toThrow('GENERATION_LIMIT');
 await expect(repository.reserve(scope,0,{...input,source:{kind:'text',prompt:'different'}})).rejects.toThrow('REQUEST_CONFLICT');
 await Promise.all(same.map(r=>repository.fail(r.id,r.version,'IMAGE_FAILED')));
 expect(await repository.usage(scope)).toEqual({used:0,limit:1});
 const results=await Promise.allSettled([repository.reserve(scope,0,request()),repository.reserve(scope,0,request())]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
});
test('only the owner can confirm the latest completed image; repeats enqueue the same shape version',async()=>{
 const {scope,other}=await fixture(),first=await repository.reserve(scope,4,request());
 await expect(repository.confirm(scope,first.id,1)).rejects.toThrow('IMAGE_NOT_READY');
 await repository.imageReady(first.id,1,'a'.repeat(64));
 const next=await repository.reserve(scope,4,{...request(),jobId:first.id,expectedVersion:1});
 expect(next.version).toBe(2);
 await expect(repository.confirm(scope,first.id,1)).rejects.toThrow('STALE_IMAGE');
 await expect(repository.confirm(other,first.id,2)).rejects.toThrow('FORBIDDEN');
 await repository.imageReady(first.id,2,'b'.repeat(64));
 const confirmed=await Promise.all(Array.from({length:5},()=>repository.confirm(scope,first.id,2)));
 expect(confirmed.every(r=>r.state==='shape_queued'&&r.version===2&&r.generation===4)).toBe(true);
 await expect(repository.reserve(scope,4,{...request(),jobId:first.id,expectedVersion:2})).rejects.toThrow('ALREADY_CONFIRMED');
 await repository.imageReady(first.id,1,'c'.repeat(64));
 expect((await repository.get(scope,first.id)).imageKey).toBe('b'.repeat(64));
});
test('durable pending work survives coordinator recreation; unauthorized rooms cannot reserve credits',async()=>{
 const {scope,other}=await fixture(),job=await repository.reserve(scope,2,request());
 const reopened=new GenerationRepository(pool);
 expect((await reopened.pending()).some(r=>r.id===job.id&&r.state==='image_queued')).toBe(true);
 await expect(reopened.reserve({...scope,roomKey:randomUUID()},0,request())).rejects.toThrow('FORBIDDEN');
 await expect(reopened.get(other,job.id)).rejects.toThrow('FORBIDDEN');
});
test('educational prompt filter normalizes obfuscated blocked terms and permits ordinary assets',()=>{
 expect(validateGenerationPrompt('  고래 모양 의자  ')).toBe('고래 모양 의자');
 for(const prompt of ['n\u200bu\u200bd\u200be girl','ＮＵＤＥ girl','아동 성착취','graphic gore'])expect(()=>validateGenerationPrompt(prompt)).toThrow('PROMPT_BLOCKED');
 expect(()=>validateGenerationPrompt('   ')).toThrow();
});

test('test-mode unlimited generation keeps usage accounting without enforcing the class cap',async()=>{
 const {scope}=await fixture(0),unlimited=new GenerationRepository(pool,true);
 for(let i=0;i<4;i++)await unlimited.reserve(scope,0,request());
 expect(await unlimited.usage(scope)).toEqual({used:4,limit:null});
});
