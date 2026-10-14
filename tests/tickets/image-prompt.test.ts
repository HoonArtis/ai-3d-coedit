import {describe,it,expect} from 'vitest';
import {prepareImagePrompt} from '../../apps/workers/src/image-prompt';

const reply=(content:string):typeof fetch=>async()=>Response.json({message:{role:'assistant',content},done:true});
describe('image prompt preparation',()=>{
 it.each([['고래','A whale'],['고래 모양의 파란 벤치','A blue whale-shaped bench']])('preserves the subject and modifiers of %s',async(original,english)=>{
  const result=await prepareImagePrompt(original,{fetch:reply(JSON.stringify({prompt:english}))});
  expect(result.original).toBe(original);expect(result.prepared).toBe(english);expect(result.model).toBe('qwen3:4b');
 });
 it('removes reasoning before parsing structured English output',async()=>{
  expect((await prepareImagePrompt('고래',{fetch:reply('<think>분석</think>\n{"prompt":"A whale"}')})).prepared).toBe('A whale');
 });
 it.each(['{"prompt":"고래"}','{"prompt":""}','{"prompt":12}','{"prompt":"A whale","extra":true}','A whale','<think>unfinished'])('fails visibly on unusable model output %s',async(content)=>{
  await expect(prepareImagePrompt('고래',{fetch:reply(content)})).rejects.toThrow('IMAGE_PROMPT_INVALID_OUTPUT');
 });
 it('does not fall back to a generic prompt when Ollama is unavailable',async()=>{
  await expect(prepareImagePrompt('고래',{fetch:async()=>{throw Error('offline');}})).rejects.toThrow('IMAGE_PROMPT_UNAVAILABLE');
 });
 it('reports a missing model',async()=>{
  await expect(prepareImagePrompt('고래',{fetch:async()=>new Response('',{status:404})})).rejects.toThrow('IMAGE_PROMPT_MODEL_UNAVAILABLE');
 });
 it.each(['','  ','a'.repeat(2001)])('rejects invalid source input before calling Ollama',async(prompt)=>{
  await expect(prepareImagePrompt(prompt,{fetch:async()=>{throw Error('must not call');}})).rejects.toThrow('INVALID_PROMPT');
 });
});
