import type {Queue} from 'bullmq';
import {removeJob} from 'bullmq/dist/esm/scripts/removeJob-2.js';
// BullMQ 6.3.14 removal script is reused so its indexes/events/dependencies stay consistent.
// The state predicate and removal MUST execute as one Redis command.
const script=`
local prefix = ARGV[3]
local id = ARGV[1]
if redis.call('EXISTS', KEYS[1]) == 0 then return 1 end
if redis.call('LPOS', prefix .. 'active', id) or redis.call('ZSCORE', prefix .. 'completed', id) or redis.call('ZSCORE', prefix .. 'failed', id) then return 0 end
if not (redis.call('LPOS', prefix .. 'wait', id) or redis.call('LPOS', prefix .. 'paused', id) or redis.call('ZSCORE', prefix .. 'delayed', id) or redis.call('ZSCORE', prefix .. 'prioritized', id)) then return 0 end
`+removeJob.content;
export async function cancelQueuedJob(queue:Queue,id:string){
 const client=await queue.getBackend().client;
 client.defineCommand('coeditCancelQueued',{numberOfKeys:2,lua:script});
 const result=await client.runCommand('coeditCancelQueued',[queue.toKey(id),queue.toKey('repeat'),id,'1',queue.toKey('')]);
 if(result!==1)throw Error('JOB_PROCESSING');
}
