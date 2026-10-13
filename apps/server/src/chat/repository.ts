import type {Pool} from 'pg';
import {jobInputSchema,type JobInput,type ChatRequest,type ChatReply,type ChatRecord} from '@coedit/contracts';
export class ChatRepository{
 constructor(private pool:Pool){}
 async migrate(){await this.pool.query(`CREATE TABLE IF NOT EXISTS coedit_chat_requests (
  ordinal bigserial UNIQUE,room_id text NOT NULL,actor text NOT NULL,request_id text NOT NULL,
  input jsonb NOT NULL,status text NOT NULL DEFAULT 'pending',model_output jsonb,response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(room_id,actor,request_id));
  CREATE UNIQUE INDEX IF NOT EXISTS coedit_chat_one_pending ON coedit_chat_requests(room_id,actor) WHERE status='pending';
  ALTER TABLE coedit_chat_requests ADD COLUMN IF NOT EXISTS job_input jsonb;`);}
 async jobInput(roomId:string,actor:string,requestId:string,input:JobInput):Promise<JobInput>{
  const row=(await this.pool.query('UPDATE coedit_chat_requests SET job_input=COALESCE(job_input,$4) WHERE room_id=$1 AND actor=$2 AND request_id=$3 RETURNING job_input',[roomId,actor,requestId,input])).rows[0];
  return jobInputSchema.parse(row.job_input);
 }
 async pending(roomId:string,actor:string):Promise<ChatRequest|null>{return (await this.pool.query("SELECT input FROM coedit_chat_requests WHERE room_id=$1 AND actor=$2 AND status IN ('pending','applying') ORDER BY ordinal LIMIT 1",[roomId,actor])).rows[0]?.input??null;}
 async claimApply(roomId:string,actor:string,requestId:string){return (await this.pool.query("UPDATE coedit_chat_requests SET status='applying' WHERE room_id=$1 AND actor=$2 AND request_id=$3 AND status IN ('pending','applying') RETURNING request_id",[roomId,actor,requestId])).rowCount===1;}
 async response(roomId:string,actor:string,requestId:string):Promise<ChatReply|null>{return (await this.pool.query('SELECT response FROM coedit_chat_requests WHERE room_id=$1 AND actor=$2 AND request_id=$3',[roomId,actor,requestId])).rows[0]?.response??null;}
 async cancel(roomId:string,actor:string,requestId:string):Promise<ChatReply>{
  const reply:ChatReply={requestId,summary:'씬에 적용하기 전에 요청을 취소했어요.',clarification:null,error:'CANCELLED'};
  const updated=await this.pool.query("UPDATE coedit_chat_requests SET status='cancelled',response=$4 WHERE room_id=$1 AND actor=$2 AND request_id=$3 AND status='pending' RETURNING request_id",[roomId,actor,requestId,reply]);
  if(updated.rowCount===1)return reply;
  const existing=await this.response(roomId,actor,requestId);if(existing)return existing;
  throw Error('CHAT_ALREADY_APPLYING');
 }
 async begin(roomId:string,actor:string,input:ChatRequest):Promise<ChatReply|null>{
  try{await this.pool.query(`INSERT INTO coedit_chat_requests(room_id,actor,request_id,input) VALUES($1,$2,$3,$4) ON CONFLICT(room_id,actor,request_id) DO NOTHING`,[roomId,actor,input.requestId,input]);}
  catch(e){if((e as {code?:string}).code==='23505')throw Error('CHAT_BUSY');throw e;}
  const row=(await this.pool.query('SELECT input,response FROM coedit_chat_requests WHERE room_id=$1 AND actor=$2 AND request_id=$3',[roomId,actor,input.requestId])).rows[0];
  // PostgreSQL jsonb changes key ordering. Compare values, never serialized key order.
  if(Object.keys(input).some(key=>JSON.stringify(row.input[key])!==JSON.stringify(input[key as keyof ChatRequest])))throw Error('REQUEST_CONFLICT');
  return row.response as ChatReply|null;
 }
 async history(roomId:string,actor:string):Promise<ChatRecord[]>{
  const rows=(await this.pool.query('SELECT input,response FROM (SELECT ordinal,input,response FROM coedit_chat_requests WHERE room_id=$1 AND actor=$2 AND response IS NOT NULL ORDER BY ordinal DESC LIMIT 100) AS recent ORDER BY ordinal',[roomId,actor])).rows;
  return rows.map(row=>({...row.response,message:row.input.message}));
 }
 async model(roomId:string,actor:string,requestId:string,output:unknown){await this.pool.query('UPDATE coedit_chat_requests SET model_output=$4 WHERE room_id=$1 AND actor=$2 AND request_id=$3',[roomId,actor,requestId,JSON.stringify(output)]);}
 async finish(roomId:string,actor:string,reply:ChatReply):Promise<ChatReply>{
  const updated=await this.pool.query("UPDATE coedit_chat_requests SET response=$4,status='finished' WHERE room_id=$1 AND actor=$2 AND request_id=$3 AND status IN ('pending','applying') RETURNING request_id",[roomId,actor,reply.requestId,reply]);
  return updated.rowCount===1?reply:(await this.response(roomId,actor,reply.requestId))??reply;
 }
}
