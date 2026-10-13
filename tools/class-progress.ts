import {readFile} from 'node:fs/promises';import {Pool} from 'pg';import {Queue} from 'bullmq';
const checkpoint=await readFile('.cache/class-acceptance-checkpoint.json','utf8').then(JSON.parse).catch(()=>null);
if(!checkpoint){console.log('No incomplete acceptance checkpoint');process.exit(0);}
if(!/^accept_[a-f0-9]+$/.test(checkpoint.schema))throw Error('INVALID_SCHEMA');
const pool=new Pool({connectionString:'postgres://coedit:coedit_local_only@127.0.0.1:54329/coedit',options:'-c search_path='+checkpoint.schema}),queue=new Queue('gpu',{connection:{host:'127.0.0.1',port:63799},prefix:'coedit'});
try{console.log(JSON.stringify({generation:(await pool.query('select state,count(*) from coedit_generation_versions group by state')).rows,finishing:(await pool.query('select phase,count(*) from coedit_generation_finishing group by phase')).rows,active:(await queue.getActive()).map(job=>({stage:job.data.stage,attempts:job.attemptsMade,elapsedSeconds:Math.round((Date.now()-(job.processedOn??Date.now()))/1000)}))}));}finally{await queue.close();await pool.end();}
