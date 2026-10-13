import {Pool} from 'pg';import {randomUUID} from 'node:crypto';import {readFile,writeFile} from 'node:fs/promises';
import {JobQueues} from '@coedit/jobs';import {LocalObjectStore} from '@coedit/artifacts';import {artifactManifestSchema} from '@coedit/contracts';
import {AccountService} from '../apps/server/src/accounts/service';import {GenerationRepository} from '../apps/server/src/generation/repository';import {FinishingRepository} from '../apps/server/src/generation/finishing-repository';import {FinishingService} from '../apps/server/src/generation/finishing-service';
const pool=new Pool({connectionString:process.env.DATABASE_URL??'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit'}),accounts=new AccountService(pool),generation=new GenerationRepository(pool),repository=new FinishingRepository(pool),queues=new JobQueues(),store=new LocalObjectStore('.data/objects'),service=new FinishingService(repository,queues,store);
await repository.migrate();await queues.ready();const t=await accounts.registerTeacher({username:'smoke-finish-'+randomUUID(),password:randomUUID()});
try{
 const c=await accounts.createClass(t.token,{name:'Finishing GPU smoke',roomCount:1}),[student]=await accounts.issueStudents(t.token,c.id,1),scope={...student,role:'student' as const};
 const imageKey=await store.put(await readFile('.cache/smoke/whale.png')),shapeKey=await store.put(await readFile('.cache/smoke/whale-raw.glb'));
 const job=await generation.reserve(scope,0,{requestId:randomUUID(),source:{kind:'upload',imageKey}});await generation.confirm(scope,job.id,1);await generation.shapeReady(job.id,1,shapeKey);
 const start=Date.now(),phases:string[]=[];
 while(Date.now()-start<600000){
  await service.reconcile();const row=await repository.get(scope,job.id,1);if(phases.at(-1)!==row.phase){phases.push(row.phase);console.log(row.phase);}
  if(['failed','material_choice'].includes(row.phase))throw Error(row.error??row.phase);
  if(row.phase==='pending_approval'){
   const manifest=artifactManifestSchema.parse(JSON.parse(new TextDecoder().decode(await store.get(row.artifactId!)))),bytes=await store.get(manifest.desktop.key);
   if(Buffer.from(bytes).toString('ascii',0,4)!=='glTF')throw Error('INVALID_GLB');
   const report={date:new Date().toISOString(),scope:'real queued background + MV texture + CPU optimization; uses previously generated actual shape/image',seconds:(Date.now()-start)/1000,phases,usage:await generation.usage(scope),artifactId:row.artifactId,manifest};
   await writeFile('docs/evidence/finishing-gpu-queue.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));break;
  }
  await new Promise(r=>setTimeout(r,750));
 }
 if(phases.at(-1)!=='pending_approval')throw Error('SMOKE_TIMEOUT');
}finally{await pool.query('DELETE FROM coedit_teachers WHERE id=$1',[t.actor]);await queues.close();await pool.end();}
