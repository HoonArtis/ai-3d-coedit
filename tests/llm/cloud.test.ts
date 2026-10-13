import {it,expect} from 'vitest';
import {ClaudeModel} from '../../apps/llm/src/claude';
const context={actor:'a',selectedId:null,cameraCenter:[0,0,0] as [number,number,number],scene:{version:1 as const,roomId:'r',generation:0,seq:0,objects:{}}};
it('requires explicit cloud configuration and parses only a complete decision',async()=>{
 let calls=0;
 const fetcher:typeof fetch=async(_u,init)=>{calls++;expect(JSON.parse(init!.body as string).model).toBe('claude-haiku-5-5');return Response.json({stop_reason:'tool_use',content:[{type:'tool_use',name:'choose_decision',input:{summary:'목록',clarification:null,ops:[{op:'list'}]}}]});};
 await expect(new ClaudeModel({fetch:fetcher}).chooseTools([],context)).rejects.toThrow('CLOUD_NOT_CONFIGURED');expect(calls).toBe(0);
 expect((await new ClaudeModel({apiKey:'test-only',fetch:fetcher}).chooseTools([],context)).ops).toEqual([{op:'list'}]);
 const malformed=new ClaudeModel({apiKey:'test-only',fetch:async()=>Response.json({stop_reason:'max_tokens',content:[]})});await expect(malformed.chooseTools([],context)).rejects.toThrow('MODEL_INVALID_OUTPUT');
});
