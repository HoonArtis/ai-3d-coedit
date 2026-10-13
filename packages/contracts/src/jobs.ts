import {z} from 'zod';
import {idSchema} from './primitives';
export const jobInputSchema=z.object({jobId:idSchema,inputVersion:z.number().int().positive(),actor:idSchema,roomId:idSchema,generation:z.number().int().nonnegative(),stage:z.enum(['image','shape','texture','optimize','vr-bake','character','llm']),payload:z.record(z.string(),z.json())}).strict();
export type JobInput=z.infer<typeof jobInputSchema>;
export type JobState={jobId:string;stage:JobInput['stage'];inputVersion:number;status:'queued'|'running'|'completed'|'failed';position:number;result?:unknown;error?:string;attempts:number};
export function acceptJobState(previous:JobState|undefined,next:JobState):JobState{
 if(!previous||previous.jobId!==next.jobId||next.inputVersion>previous.inputVersion)return next;
 if(next.inputVersion<previous.inputVersion||previous.status==='completed'||previous.status==='failed')return previous;
 if(previous.attempts>next.attempts)return previous;
 return next;
}
