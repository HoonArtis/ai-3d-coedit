import type {ModelPort,ChatMessage,ModelContext} from './model-port';
import {buildMessages} from './prompt';
import {decisionJSONSchema,parseDecision} from './tools';
export class ClaudeModel implements ModelPort{
 constructor(private options:{apiKey?:string;model?:string;timeoutMs?:number;fetch?:typeof fetch}={}){}
 async chooseTools(messages:ChatMessage[],context:ModelContext){
  if(!this.options.apiKey)throw Error('CLOUD_NOT_CONFIGURED');
  const signal=AbortSignal.timeout(this.options.timeoutMs??60000),built=buildMessages(messages,context);
  try{
   const response=await (this.options.fetch??fetch)('https://api.anthropic.com/v1/messages',{
    method:'POST',headers:{'Content-Type':'application/json','x-api-key':this.options.apiKey,'anthropic-version':'2023-06-01'},signal,
    body:JSON.stringify({model:this.options.model??'claude-haiku-5-5',max_tokens:4096,system:built[0].content+'\nchoose_decision 도구로 결정 하나만 반환한다.',messages:built.slice(1),tools:[{name:'choose_decision',description:'원자적 씬 요청 또는 질문을 선택한다.',input_schema:decisionJSONSchema}],tool_choice:{type:'auto'}}),
   });
   if(!response.ok)throw Error(response.status===404?'MODEL_UNAVAILABLE':'MODEL_HTTP_'+response.status);
   const body=await response.json() as {stop_reason?:string;content?:{type:string;name?:string;input?:unknown}[]};
   const calls=body.content?.filter(c=>c.type==='tool_use')??[];
   if(body.stop_reason!=='tool_use'||calls.length!==1||calls[0].name!=='choose_decision')throw Error('MODEL_INVALID_OUTPUT');
   try{return parseDecision(calls[0].input);}catch{throw Error('MODEL_INVALID_OUTPUT');}
  }catch(error){if(signal.aborted)throw Error('MODEL_TIMEOUT');throw error;}
 }
}
