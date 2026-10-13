import {test,expect,beforeAll,afterAll} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {AccountService} from '../../apps/server/src/accounts/service';
import {GenerationRepository} from '../../apps/server/src/generation/repository';
import {FinishingRepository} from '../../apps/server/src/generation/finishing-repository';
import {FinishingService} from '../../apps/server/src/generation/finishing-service';
import {JobQueues} from '@coedit/jobs';
import {LocalObjectStore} from '@coedit/artifacts';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const connectionString=process.env.TEST_DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit';
const schema='finish_test_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString}),pool=new Pool({connectionString,options:'-c search_path='+schema});
const accounts=new AccountService(pool),generation=new GenerationRepository(pool),repo=new FinishingRepository(pool);
beforeAll(async()=>{await admin.query('CREATE SCHEMA '+schema);await accounts.migrate();await generation.migrate();await repo.migrate();});
afterAll(async()=>{await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();});
async function fixture(){const t=await accounts.registerTeacher({username:'finish-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(t.token,{name:'finish',roomCount:1}),[s,other]=await accounts.issueStudents(t.token,c.id,2),scope={...s,role:'student' as const};const job=await generation.reserve(scope,0,{requestId:randomUUID(),source:{kind:'upload',imageKey:'a'.repeat(64)}});await generation.confirm(scope,job.id,1);await generation.shapeReady(job.id,1,'b'.repeat(64));return {scope,other:{...other,role:'student' as const},job};}
test('durable finishing outbox preserves one transition, requires explicit owner preset after texture failure',async()=>{
 const {scope,other,job}=await fixture();await Promise.all([repo.discover(),repo.discover()]);
 expect((await repo.pending()).filter(x=>x.jobId===job.id)).toHaveLength(1);
 await repo.textureFailed(job.id,1,'TEXTURE_FAILED');expect((await repo.get(scope,job.id,1)).phase).toBe('material_choice');
 await expect(repo.choosePreset(other,job.id,1,'wood')).rejects.toThrow('FORBIDDEN');
 await expect(repo.choosePreset(scope,job.id,1,'automatic')).rejects.toThrow();
 await repo.choosePreset(scope,job.id,1,'wood');await repo.choosePreset(scope,job.id,1,'wood');
 await expect(repo.choosePreset(scope,job.id,1,'metal')).rejects.toThrow('PRESET_ALREADY_SELECTED');
 await repo.textureReady(job.id,1,'c'.repeat(64));const row=await repo.get(scope,job.id,1);
 expect(row.phase).toBe('optimize_queued');expect(row.preset).toBe('wood');expect(row.textureKey).toBeNull();
 expect((await generation.usage(scope)).used).toBe(1);
});
test('coordinator resumes durable queue stages and refuses artifact belonging to another job',async()=>{
 const {scope,job}=await fixture(),dir=await mkdtemp(join(tmpdir(),'coedit-finish-')),store=new LocalObjectStore(dir),queues=new JobQueues({prefix:'finish-'+randomUUID()});await queues.ready();
 const service=new FinishingService(repo,queues,store),counts={texture:0,optimize:0};
 const worker=queues.worker('gpu',async()=>{counts.texture++;return {key:await store.put(Buffer.from('texture-fixture'))};});
 const cpu=queues.worker('cpu',async input=>{
  counts.optimize++;const key=await store.put(Buffer.from('desktop-fixture'));
  return {artifactId:await store.put(new TextEncoder().encode(JSON.stringify({formatVersion:1,jobId:'wrong-job',version:input.inputVersion,generation:input.generation,originalKey:key,desktop:{key,triangles:1,drawCalls:1,dimensions:[1,1,1],textures:[]},provenance:{texture:'mv-adapter',researchOnly:true,sources:[]}})))};
 });
 try{
  for(let i=0;i<100;i++){await service.reconcile();if((await repo.get(scope,job.id,1)).phase==='failed')break;await new Promise(r=>setTimeout(r,30));}
  expect((await repo.get(scope,job.id,1)).error).toBe('INVALID_ARTIFACT_RESULT');expect((await generation.usage(scope)).used).toBe(0);expect(counts.texture).toBe(1);expect(counts.optimize).toBeGreaterThanOrEqual(1);
 }finally{await worker.close();await cpu.close();await queues.close();await rm(dir,{recursive:true,force:true});}
});
test.each([0,1])('completed artifact checks current room generation %i and remains approval-only',async(currentGeneration)=>{
 const {scope,job}=await fixture(),dir=await mkdtemp(join(tmpdir(),'coedit-generation-')),store=new LocalObjectStore(dir),queues=new JobQueues({prefix:'generation-check-'+randomUUID()});await queues.ready();
 const checked:string[]=[],service=new FinishingService(repo,queues,store,async id=>{checked.push(id);return currentGeneration;});
 const key=await store.put(Buffer.from('verified-output-fixture'));await repo.discover();await repo.textureReady(job.id,1,key);
 const cpu=queues.worker('cpu',async input=>({artifactId:await store.put(new TextEncoder().encode(JSON.stringify({formatVersion:1,jobId:input.jobId,version:input.inputVersion,generation:input.generation,originalKey:key,desktop:{key,triangles:1,drawCalls:1,dimensions:[1,1,1],textures:[]},provenance:{texture:'mv-adapter',researchOnly:true,sources:[]}})))}));
 try{
  for(let i=0;i<100;i++){await service.reconcile();if((await repo.get(scope,job.id,1)).phase==='pending_approval')break;await new Promise(r=>setTimeout(r,30));}
  const row=await repo.get(scope,job.id,1);expect(row.phase).toBe('pending_approval');expect(row.staleScene).toBe(currentGeneration!==0);expect(checked).toContain(scope.roomKey);expect((await generation.usage(scope)).used).toBe(1);
 }finally{await cpu.close();await queues.close();await rm(dir,{recursive:true,force:true});}
});

test('character upload uses the CPU conversion outbox without image/shape/texture inference',async()=>{
 const t=await accounts.registerTeacher({username:'character-'+randomUUID(),password:'test-password-1234'}),c=await accounts.createClass(t.token,{name:'characters',roomCount:1}),[s]=await accounts.issueStudents(t.token,c.id,1),scope={...s,role:'student' as const};
 const source={kind:'character',format:'fbx',name:'My avatar',inputKey:'c'.repeat(64)};
 const job=await generation.reserve(scope,0,{requestId:'character-upload',source});
 expect(job.state).toBe('shape_ready');expect(job.imageKey).toBeNull();expect(job.shapeKey).toBe(source.inputKey);
 await repo.discover();const row=(await repo.pending()).find(r=>r.jobId===job.id);expect(row).toMatchObject({phase:'optimize_queued',source});
 expect((await generation.pending()).some(r=>r.id===job.id)).toBe(false);expect((await generation.usage(scope)).used).toBe(1);
});
