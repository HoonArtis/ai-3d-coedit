import type {ModelPort,ChatMessage,ModelContext} from './model-port';
import {buildMessages} from './prompt';
import {decisionJSONSchema,parseDecision} from './tools';
export class OllamaModel implements ModelPort{
 constructor(private options:{url?:string;model?:string;timeoutMs?:number;fetch?:typeof fetch}={}){}
 async chooseTools(messages:ChatMessage[],context:ModelContext){
  const signal=AbortSignal.timeout(this.options.timeoutMs??60000);
  try{
   const response=await (this.options.fetch??fetch)(new URL('/api/chat',this.options.url??'http://127.0.0.1:11434'),{
    method:'POST',headers:{'Content-Type':'application/json'},signal,
    body:JSON.stringify({model:this.options.model??'qwen3:4b',messages:buildMessages(messages,context),stream:false,think:false,format:decisionJSONSchema,options:{temperature:0,num_ctx:16384,num_predict:2048}}),
   });
   if(!response.ok)throw Error(response.status===404?'MODEL_UNAVAILABLE':'MODEL_HTTP_'+response.status);
   const body=await response.json() as {message?:{content?:string}};
   try{return parseDecision(JSON.parse(body.message?.content??''));}catch{throw Error('MODEL_INVALID_OUTPUT');}
  }catch(error){if(signal.aborted)throw Error('MODEL_TIMEOUT');throw error;}
 }
}
