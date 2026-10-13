import type {generationProgressSchema} from '@coedit/contracts';
type Progress=ReturnType<typeof generationProgressSchema.parse>;
const finishLabels={texture_queued:'텍스처 작업 대기·처리 중…',material_choice:'텍스처 생성 실패 · 재질을 직접 골라 주세요',optimize_queued:'감량·텍스처 압축 중…',pending_approval:'강사 승인 대기',approved:'공유 라이브러리에 등록됐어요',rejected:'강사가 사용을 승인하지 않았어요',failed:'후처리 실패 · 횟수가 반환됐어요'};
const failures:Record<string,string>={IMAGE_FAILED:'이미지를 그리는 단계에서 실패했어요.',SHAPE_FAILED:'3D 형상을 만드는 단계에서 실패했어요.',TEXTURE_FAILED:'텍스처를 만드는 단계에서 실패했어요.',OPTIMIZE_FAILED:'감량·텍스처 압축 단계에서 실패했어요.',INVALID_WORKER_RESULT:'생성 결과 파일을 확인하지 못했어요.',INVALID_ARTIFACT_RESULT:'배포용 결과 파일을 확인하지 못했어요.'};
export function generationStatus(job:Progress){
  const label=job.source.kind==='character'&&job.state==='shape_ready'&&(!job.finishing||job.finishing.phase==='optimize_queued')?'캐릭터 변환·뼈대 검증 중…':job.finishing?finishLabels[job.finishing.phase]:job.state==='image_queued'?(job.running?'이미지를 그리는 중…':`이미지 대기 ${job.position}번째`):job.state==='awaiting_confirmation'?'이미지를 확인해 주세요':job.state==='shape_queued'?(job.running?'3D 모양을 만드는 중…':`3D 대기 ${job.position}번째`):job.state==='shape_ready'?'형상 생성 완료 · 후처리 준비 중':'생성 실패 · 횟수가 반환됐어요';
  const failed=job.state==='failed'||job.finishing?.phase==='failed'||job.finishing?.phase==='material_choice',code=job.finishing?.error??job.error;
  return {label,failure:failed?(failures[code??'']??'생성 작업을 완료하지 못했어요.'):null,hint:job.source.kind==='character'&&failed?'캐릭터 변환에 실패해 기본 VR 아바타를 사용합니다. 뼈대와 파일 형식을 확인한 뒤 다시 업로드하세요.':job.finishing?.phase==='material_choice'?'아래 재질을 직접 선택해 이어갈 수 있어요. 추가 횟수는 사용하지 않아요.':failed?'설명을 입력해 재시도하거나 새 그림을 업로드하세요. 최종 실패한 횟수는 반환돼요.':null};
}
