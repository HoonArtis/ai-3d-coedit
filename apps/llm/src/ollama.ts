import type {ModelPort,ChatMessage,ModelContext} from './model-port';
import {buildMessages} from './prompt';
import {decisionJSONSchema,decisionJSONSchemaFor,parseDecision} from './tools';
import {routerMessages,routeJSONSchema,parseRoute,WORKFLOWS,type Workflow} from './router';
/**
 * routing(기본): 1단계로 워크플로우를 고르고, 2단계에서 그 워크플로우의 규칙과 도구만 보고 결정한다.
 * 분류 결과가 깨지면 도구 전체를 보는 단일 단계로 이어 간다. 연결·HTTP 오류와 시간 초과는 그대로 실패한다.
 */
export class OllamaModel implements ModelPort{
 constructor(private options:{url?:string;model?:string;timeoutMs?:number;fetch?:typeof fetch;routing?:boolean;onRoute?:(workflow:Workflow|null)=>void}={}){}
 /** num_ctx는 두 단계가 같아야 한다. 다르면 Ollama가 호출마다 모델을 다시 올려 한 요청이 수십 초가 된다(2026-10-15 실측 2.4초→18.7초). */
 private async call(messages:unknown,format:unknown,signal:AbortSignal,num_predict:number){
  const response=await (this.options.fetch??fetch)(new URL('/api/chat',this.options.url??'http://127.0.0.1:11434'),{
   method:'POST',headers:{'Content-Type':'application/json'},signal,
   body:JSON.stringify({model:this.options.model??'qwen3:4b',messages,stream:false,think:false,format,options:{temperature:0,num_ctx:16384,num_predict}}),
  });
  if(!response.ok)throw Error(response.status===404?'MODEL_UNAVAILABLE':'MODEL_HTTP_'+response.status);
  const body=await response.json() as {message?:{content?:string}};
  try{return JSON.parse(body.message?.content??'') as unknown;}catch{return undefined;}
 }
 async route(messages:ChatMessage[],context:ModelContext,signal:AbortSignal):Promise<Workflow|null>{
  return parseRoute(await this.call(routerMessages(messages,context),routeJSONSchema,signal,32));
 }
 async chooseTools(messages:ChatMessage[],context:ModelContext){
  const signal=AbortSignal.timeout(this.options.timeoutMs??60000);
  try{
   const workflow=this.options.routing===false?null:await this.route(messages,context,signal);
   this.options.onRoute?.(workflow);
   const format=workflow?decisionJSONSchemaFor(WORKFLOWS[workflow]):decisionJSONSchema;
   const output=await this.call(buildMessages(messages,context,workflow??undefined),format,signal,2048);
   try{return parseDecision(output);}catch{throw Error('MODEL_INVALID_OUTPUT');}
  }catch(error){if(signal.aborted)throw Error('MODEL_TIMEOUT');throw error;}
 }
}
