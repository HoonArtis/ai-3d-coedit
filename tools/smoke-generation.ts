import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {writeFile,readFile} from 'node:fs/promises';
import {JobQueues} from '@coedit/jobs';
import {LocalObjectStore} from '@coedit/artifacts';
import {AccountService} from '../apps/server/src/accounts/service';
import {GenerationRepository} from '../apps/server/src/generation/repository';
import {ImageService} from '../apps/server/src/generation/image-service';
const pool=new Pool({connectionString:process.env.DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'}),queues=new JobQueues();
const accounts=new AccountService(pool),repo=new GenerationRepository(pool),images=new ImageService(repo,queues,new LocalObjectStore('.data/objects'));
let actor='';
try{
 await accounts.migrate();await repo.migrate();await queues.ready();
 const teacher=await accounts.registerTeacher({username:'gpu-smoke-'+randomUUID(),password:'local-smoke-password-1234'});actor=teacher.actor;
 const c=await accounts.createClass(teacher.token,{name:'GPU pipeline smoke',roomCount:1}),[student]=await accounts.issueStudents(teacher.token,c.id,1),scope={...student,role:'student' as const};
 const start=Date.now(),job=await images.text(scope,0,randomUUID(),'a whimsical blue whale shaped wooden bench');
 const wait=async(state:string)=>{const deadline=Date.now()+600000;let last='';for(;;){await images.reconcile();const current=await repo.get(scope,job.id);if(current.state!==last){console.log(current.state,((Date.now()-start)/1000).toFixed(2));last=current.state;}if(current.state===state)return current;if(current.state==='failed')throw Error(current.error??'FAILED');if(Date.now()>deadline)throw Error('TIMEOUT');await new Promise(r=>setTimeout(r,500));}};
 const image=await wait('awaiting_confirmation'),imageSeconds=(Date.now()-start)/1000;
 await images.confirm(scope,job.id,image.version);await images.confirm(scope,job.id,image.version);
 const shape=await wait('shape_ready');
 const artifact=await new LocalObjectStore('.data/objects').get(shape.shapeKey!);if(Buffer.from(artifact).readUInt32LE(0)!==0x46546c67)throw Error('INVALID_GLB_MAGIC');
 const result=await queues.status(await queues.enqueue({jobId:shape.id,inputVersion:shape.version,actor:shape.actor,roomId:shape.roomId,generation:shape.generation,stage:'shape',payload:{imageKey:shape.imageKey}}));if(result?.status!=='completed')throw Error('WORKER_NOT_COMPLETED');
 const report={date:new Date().toISOString(),imageSeconds,totalSeconds:(Date.now()-start)/1000,job:shape,usage:await repo.usage(scope),conditions:'Actual PostgreSQL + Redis + separate GPU worker; SDXL + RMBG + TripoSG. Texture/optimization/approval excluded.'};
 await writeFile('docs/evidence/generation-gpu-queue.json',JSON.stringify(report,null,2));console.log('ACTUAL_GPU_QUEUE_PASS',JSON.stringify(report));
}finally{if(actor)await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[actor]);await queues.close();await pool.end();}
