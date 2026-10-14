import {test,expect,beforeAll,afterAll} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {LocalObjectStore} from '@coedit/artifacts';
import {JobQueues} from '@coedit/jobs';
import {AccountService} from '../../apps/server/src/accounts/service';
import {GenerationRepository} from '../../apps/server/src/generation/repository';
import {ImageService,normalizeUpload} from '../../apps/server/src/generation/image-service';
const connectionString=process.env.TEST_DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit';
const schema='image_test_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString}),pool=new Pool({connectionString,options:'-c search_path='+schema});
const accounts=new AccountService(pool),repo=new GenerationRepository(pool),queues=new JobQueues({prefix:'gen-test-'+randomUUID()});
let dir:string,store:LocalObjectStore,service:ImageService;const teachers:string[]=[];
beforeAll(async()=>{await admin.query('CREATE SCHEMA '+schema);await accounts.migrate();await repo.migrate();await queues.ready();dir=await mkdtemp(join(tmpdir(),'coedit-gen-'));store=new LocalObjectStore(dir);service=new ImageService(repo,queues,store);});
afterAll(async()=>{for(const id of teachers)await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[id]);await queues.close();await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();await rm(dir,{recursive:true,force:true});});
async function scope(){const t=await accounts.registerTeacher({username:'image-'+randomUUID(),password:'test-password-1234'});teachers.push(t.actor);const c=await accounts.createClass(t.token,{name:'image',roomCount:1});const [s]=await accounts.issueStudents(t.token,c.id,1);return {...s,role:'student' as const};}
const png=()=>sharp({create:{width:32,height:32,channels:4,background:'#1080ff'}}).png().toBuffer();
async function until(check:()=>Promise<boolean>){for(let i=0;i<100;i++){await service.reconcile();if(await check())return;await new Promise(r=>setTimeout(r,30));}throw Error('WAIT_TIMEOUT');}
test('decode rejects corrupt/disguised/massive uploads before reservation',async()=>{
 const s=await scope();
 for(const bytes of [Buffer.from('broken'),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"></svg>'),Buffer.alloc(10*1024*1024+1)])await expect(service.upload(s,0,randomUUID(),bytes)).rejects.toThrow();
 expect((await repo.usage(s)).used).toBe(0);
 const normalized=await normalizeUpload(await png());expect((await sharp(normalized).metadata()).format).toBe('png');
 const large=await sharp({create:{width:3000,height:3000,channels:3,background:'white'}}).png().toBuffer();await expect(normalizeUpload(large)).rejects.toThrow();
});
test('actual Redis queue waits for confirmation, deduplicates shape and recovers persisted image work',async()=>{
 const s=await scope();let imageCalls=0,shapeCalls=0;
 const worker=queues.worker('gpu',async input=>{
  if(input.stage==='image'){imageCalls++;return {key:await store.put(await png())};}
  if(input.stage==='shape'){shapeCalls++;return {key:await store.put(Buffer.from('fixture-glb'))};}
  throw Error('WRONG_STAGE');
 });
 try{
  const job=await repo.reserve(s,0,{requestId:randomUUID(),source:{kind:'text',prompt:'a blue chair'}});
  service=new ImageService(repo,queues,store);
  await until(async()=>(await repo.get(s,job.id)).state==='awaiting_confirmation');
  expect(imageCalls).toBe(1);expect(shapeCalls).toBe(0);
  await Promise.all(Array.from({length:5},()=>service.confirm(s,job.id,1)));
  await until(async()=>(await repo.get(s,job.id)).state==='shape_ready');
  expect(shapeCalls).toBe(1);expect((await repo.usage(s)).used).toBe(1);
  const upload=await service.upload(s,0,randomUUID(),await png());expect(upload.state).toBe('awaiting_confirmation');
  await service.reconcile();expect(imageCalls).toBe(1);expect(shapeCalls).toBe(1);
 }finally{await worker.close();}
});

test('quota and duplicate/conflicting uploads admit before storing; storage failure rolls reservation back',async()=>{
 const s=await scope();await pool.query('UPDATE coedit_classes SET generation_limit=1 WHERE id=(SELECT class_id FROM coedit_class_rooms WHERE id=$1)',[s.roomKey]);let writes=0;const counted={get:store.get.bind(store),put:async(bytes:Uint8Array)=>{writes++;return store.put(bytes);}},images=new ImageService(repo,queues,counted),bytes=await png();
 await Promise.all(Array.from({length:5},()=>images.upload(s,0,'same',bytes)));expect(writes).toBe(1);
 await expect(images.upload(s,0,'other',bytes)).rejects.toThrow('GENERATION_LIMIT');expect(writes).toBe(1);
 const different=await sharp({create:{width:32,height:32,channels:4,background:'red'}}).png().toBuffer();await expect(images.upload(s,0,'same',different)).rejects.toThrow('REQUEST_CONFLICT');expect(writes).toBe(1);
 const other=await scope(),broken=new ImageService(repo,queues,{get:store.get.bind(store),put:async()=>{throw Error('DISK_FULL');}});await expect(broken.upload(other,0,'disk',bytes)).rejects.toThrow('DISK_FULL');expect(await repo.list(other)).toHaveLength(0);expect((await repo.usage(other)).used).toBe(0);
});

test('queued cancellation refunds once, resists stale dispatch and ignores late results',async()=>{
 const s=await scope(),other=await scope(),job=await service.text(s,0,randomUUID(),'a blue whale');
 await expect(service.cancel(other,job.id,job.version)).rejects.toThrow('FORBIDDEN');
 await Promise.all([service.cancel(s,job.id,job.version),service.progress(s),service.reconcile()]);
 await service.cancel(s,job.id,job.version);await service.reconcile();
 expect((await repo.get(s,job.id)).state).toBe('cancelled');expect((await repo.usage(s)).used).toBe(0);
 await repo.imageReady(job.id,job.version,'a'.repeat(64));expect((await repo.get(s,job.id)).state).toBe('cancelled');
 let calls=0;const worker=queues.worker('gpu',async input=>{if(input.jobId===job.id)calls++;return {key:await store.put(await png())};});
 try{await service.progress(s);await service.reconcile();await new Promise(r=>setTimeout(r,100));expect(calls).toBe(0);}finally{await worker.close();}
});

test('running work cannot be cancelled; completed image hide/delete keeps quota and shared image data',async()=>{
 const s=await scope(),other=await scope();let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const worker=queues.worker('gpu',async()=>{await gate;return {key:await store.put(await png())};});
 try{
  const job=await service.text(s,0,randomUUID(),'a whale');await until(async()=>(await service.progress(s))[0].running);
  await expect(service.cancel(s,job.id,job.version)).rejects.toThrow('JOB_PROCESSING');expect((await repo.usage(s)).used).toBe(1);
  release();await until(async()=>(await repo.get(s,job.id)).state==='awaiting_confirmation');
  await expect(repo.visibility(other,job.id,1,'hidden')).rejects.toThrow('FORBIDDEN');
  await repo.visibility(s,job.id,1,'hidden');expect((await service.progress(s))[0].visibility).toBe('hidden');await repo.visibility(s,job.id,1,'visible');
  const shared=await service.upload(other,0,randomUUID(),await png());
  await repo.visibility(s,job.id,1,'deleted');expect(await repo.list(s)).toHaveLength(0);expect((await repo.usage(s)).used).toBe(1);
  await expect(service.image(s,job.id)).rejects.toThrow('FORBIDDEN');await expect(service.confirm(s,job.id,1)).rejects.toThrow('FORBIDDEN');
  expect((await service.image(other,shared.id)).byteLength).toBeGreaterThan(0);
 }finally{release();await worker.close();}
});
