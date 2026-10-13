import {JobQueues} from '../../packages/jobs/src/index';
const q=new JobQueues({prefix:process.argv[2]});await q.ready();
q.worker('gpu',async()=>{process.exit(24);},{lockDuration:400,stalledInterval:400});
