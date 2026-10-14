import {test,expect} from 'vitest';import {generationStatus} from '../../apps/web/src/generation/status';import type {GenerationRecord} from '@coedit/contracts';
const job={id:'job',actor:'student',roomId:'room',generation:0,version:1,state:'failed',source:{kind:'text',prompt:'bench'},imageKey:null,shapeKey:null,error:'SHAPE_FAILED',position:0,running:false} as GenerationRecord&{position:number;running:boolean};
test('failed stages explain the stopping point and retry without claiming completion',()=>{
 const status=generationStatus(job);expect(status.label).toContain('실패');expect(status.failure).toContain('3D 형상');expect(status.hint).toContain('재시도');
 const finish={jobId:'job',version:1,phase:'material_choice' as const,preset:null,textureKey:null,artifactId:null,error:'TEXTURE_FAILED',staleScene:false};const texture=generationStatus({...job,state:'shape_ready',error:null,finishing:finish});expect(texture.failure).toContain('텍스처');expect(texture.hint).toContain('재질');expect(texture.hint).toContain('추가 횟수');
 const optimized=generationStatus({...job,finishing:{...finish,phase:'failed',error:'OPTIMIZE_FAILED'}});expect(optimized.failure).toContain('감량');
});
test('image and shape queue show stage and running state; registration is distinct from completed placement',()=>{
 expect(generationStatus({...job,state:'image_queued',running:true}).label).toBe('프롬프트 정리·이미지 생성 중…');
 expect(generationStatus({...job,state:'image_queued',error:null,position:3}).label).toBe('이미지 대기 3번째');expect(generationStatus({...job,state:'shape_queued',error:null,running:true}).label).toContain('3D 모양');
 expect(generationStatus({...job,state:'shape_ready',error:null,finishing:{jobId:'job',version:1,phase:'pending_approval',preset:null,textureKey:null,artifactId:'a'.repeat(64),error:null,staleScene:false}}).label).toBe('라이브러리 등록 중…');
});
test('cancelled requests show cancellation without failure or retry instructions',()=>{
 const status=generationStatus({...job,state:'cancelled',error:null});expect(status.label).toContain('요청 취소');expect(status.failure).toBeNull();expect(status.hint).toBeNull();
});
test('prompt preparation errors explain that image preparation stopped',()=>{
 expect(generationStatus({...job,error:'IMAGE_PROMPT_TIMEOUT'}).failure).toContain('이미지용 프롬프트로 정리하지 못했어요');
});
