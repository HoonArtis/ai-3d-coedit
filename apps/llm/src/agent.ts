import type {ModelPort,ChatMessage,ModelContext} from './model-port';
import {parseDecision} from './tools';
import {preflight,postcheck} from './guards';
import type {OllamaModel} from './ollama';
import type {Workflow} from './router';
/**
 * 챗봇 에이전트: 분류 → (결정적 전처리) → 워크플로우 결정 → (결정적 후검사).
 * 다음 단계의 "연습장 확인 → 다시 계획" 루프도 여기에 붙인다. guards:false는 비교 평가용.
 */
export class ChatAgent implements ModelPort{
 constructor(private model:OllamaModel,private options:{timeoutMs?:number;routing?:boolean;guards?:boolean;onRoute?:(workflow:Workflow|null)=>void}={}){}
 async chooseTools(messages:ChatMessage[],context:ModelContext){
  const signal=AbortSignal.timeout(this.options.timeoutMs??60000),guards=this.options.guards!==false;
  const message=messages.findLast(m=>m.role==='user')?.content??'';
  try{
   const workflow=this.options.routing===false?null:await this.model.route(messages,context,signal);
   this.options.onRoute?.(workflow);
   const early=guards?preflight(message,context,workflow):null;
   if(early)return parseDecision(early);
   const decision=await this.model.decide(messages,context,workflow,signal);
   try{return parseDecision(guards?postcheck(decision,message,context,workflow):decision);}catch{throw Error('MODEL_INVALID_OUTPUT');}
  }catch(error){if(signal.aborted)throw Error('MODEL_TIMEOUT');throw error;}
 }
}
