import {describe,it,expect} from 'vitest';
import {prepareImagePrompt,prepareTexturePrompt,TEXTURE_FALLBACK_PROMPT} from '../../apps/workers/src/image-prompt';

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
describe('texture prompt preparation',()=>{
 const ok=(english:string)=>async(original:string)=>({original,prepared:english,model:'qwen3:4b',version:1 as const});
 const broken=async()=>{throw Error('IMAGE_PROMPT_UNAVAILABLE');};
 it('넘기는 문장은 학생 원문이 아니라 영어 정리본이다',async()=>{
  expect(await prepareTexturePrompt('빨간 우산 쓴 고양이','image-geometry',ok('A cat holding a red umbrella'))).toEqual({original:'빨간 우산 쓴 고양이',prepared:'A cat holding a red umbrella',fallback:false});
  expect((await prepareTexturePrompt('금색 의자','text-geometry',ok('A gold chair'))).prepared).toBe('A gold chair');
 });
 it('참고 이미지가 있으면 정리 실패 시 한국어 대신 중립 영어로 진행한다',async()=>{
  expect(await prepareTexturePrompt('고래','image-geometry',broken)).toMatchObject({prepared:TEXTURE_FALLBACK_PROMPT,fallback:true,error:'IMAGE_PROMPT_UNAVAILABLE'});
 });
 it('글만 있는 재텍스처는 정리 실패를 그대로 실패시킨다',async()=>{
  await expect(prepareTexturePrompt('금색','text-geometry',broken)).rejects.toThrow('IMAGE_PROMPT_UNAVAILABLE');
 });
 it('기본 영어 문장은 정리기를 부르지 않는다',async()=>{
  expect((await prepareTexturePrompt(TEXTURE_FALLBACK_PROMPT,'image-geometry',async()=>{throw Error('must not call');})).prepared).toBe(TEXTURE_FALLBACK_PROMPT);
 });
});
