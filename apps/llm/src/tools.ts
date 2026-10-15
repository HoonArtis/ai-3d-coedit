import {z} from 'zod';
import {opSchema,type Op,TEACHER_ONLY_OPS as teacherOnly,modelDecisionSchema,parseStudentDecision} from '../../../packages/contracts/src/index';
const descriptions:Partial<Record<Op['op'],[string,string,string]>>={
 place:['라이브러리 에셋 하나 배치. 새 고유 id와 바닥 기준 위치.','책상 하나 놔줘','원점에 화분 놓아줘'],
 move:['기존 에셋의 절대 위치(m)를 지정. 상대 이동은 현재 위치에 더한다.','왼쪽으로 2m','위치를 1,0,3으로'],
 rotate:['절대 Euler XYZ 회전(rad). 도를 라디안으로 변환.','Y축 90도 회전','회전을 초기화해'],
 scale:['절대 XYZ 크기 배율 0.01~100.','두 배로 키워','높이만 반으로'],
 duplicate:['자기 에셋 복제. newId는 새 고유 ID.','하나 복사해','이거 세 개 복제해'],
 delete:['자기 에셋 삭제.','선택한 것 삭제','내 나무 지워'],
 rename:['이름 변경.','이름을 작은 숲으로','이 의자를 내 의자로 이름 지어'],
 snap_to_ground:['바닥에 붙이기. 높이는 서버가 계산.','바닥에 붙여','땅으로 내려'],
 generate:['새 모양 이미지 생성 요청. 승인과 횟수 제한 적용.','고래 모양 벤치 만들어','별 모양 분수 생성해'],
 upload_character:['이미 업로드 완료된 uploadId 캐릭터 등록.','올린 캐릭터 등록해','내 업로드 모델 사용해'],
 retexture:['자기 에셋 재질 생성 요청.','빨갛게 칠해','나무 재질로 바꿔'],
 replace_asset:['승인된 라이브러리 결과로 자기 객체의 모델을 교체. 현재 객체 revision과 방 generation이 요청 값과 같아야 적용. 재질 생성에는 retexture를 사용.','승인된 재질 결과 적용해','이 승인 모델로 교체해'],
 arrange_around:['targetId 주위에 assetId 여러 개를 원형 배치. ids는 새 고유 ID 배열, 개수=요청 수. 좌표 계산 금지.','탁자 주위에 의자 4개','나무 둘레에 벤치 3개'],
 align_row:['기존 ids를 축 방향 일렬 배치. 첫 물체가 기준, 간격 m.','나무들을 일렬로','의자를 X축 2m 간격으로'],
 distribute:['기존 ids를 축 방향 양끝 사이 등간격 배치.','의자 간격 균등하게','나무를 Z축으로 고르게'],
 scatter:['직사각형 min/max 범위 안에 새 ids를 seed로 무작위 배치. 겹침은 서버 판정.','이 구역에 화분 5개 흩뿌려','꽃을 여기저기'],
 place_on:['id를 targetId 위에 놓기. 높이는 서버 계산.','책상 위에 화분','블록 위에 화분 놓아'],
 face_toward:['id가 targetId 쪽을 보도록 회전.','의자가 책상을 보게','벤치가 나무를 향하게'],
 arrange_nicely:['ids의 내 물체를 서로 어울리게 다시 배치. 의자는 탁자를 둘러, 벤치는 나무 앞, 화분은 탁자 위. 좌표는 서버가 계산.','어울리게 배치해줘','알아서 정리해줘'],
 recommend:['씬에 어울리는 에셋을 추천. 씬을 바꾸지 않음. focusId는 특정 물체와 어울리는 것을 찾을 때만.','뭐 놓으면 어울려','이거랑 어울리는 거 추천해줘'],
 list:['씬 목록 조회.','내가 놓은 거 뭐 있어','목록 보여줘'],
 find:['이름으로 찾기.','나무 찾아','의자 검색해'],
 describe_scene:['씬 설명 조회.','현재 씬 설명해','공간에 뭐가 있어'],
 undo:['직전 내 명령 한 건 되돌리기. 단독 op.','방금 거 취소','되돌려'],
 redo:['되돌린 내 명령 다시 실행. 단독 op.','다시 해','취소한 거 복구'],
 lock:['명시적으로 자기 에셋 잠금. 일반 수정은 서버 자동 잠금. 단독 op.','내 의자 잠가','내 나무 선택 잠금'],
 unlock:['자기 잠금 해제. 단독 op.','선택 잠금 해제','내 의자 잠금 풀어'],
};
export const studentTools=opSchema.options.filter(s=>!teacherOnly.has(s.shape.op.value)).map(schema=>{
 const name=schema.shape.op.value;const [purpose,a,b]=descriptions[name]!;
 const parameters=z.toJSONSchema(schema,{target:"draft-7"});delete parameters.properties!.op;
 parameters.required=parameters.required!.filter(key=>key!=='op');
 return {type:'function' as const,function:{name,description:`${purpose} 예: ${a}. 예: ${b}.`,parameters}};
});
export const decisionSchema=modelDecisionSchema;
export type ModelDecision=z.infer<typeof decisionSchema>;
export const decisionJSONSchema=z.toJSONSchema(decisionSchema,{target:"draft-7"});
// Restrict generation as well as validation. The authoritative server still checks permissions.
(decisionJSONSchema.properties!.ops as {items:unknown}).items={anyOf:opSchema.options.filter(s=>!teacherOnly.has(s.shape.op.value)).map(s=>z.toJSONSchema(s,{target:"draft-7"}))};
export const parseDecision=parseStudentDecision;
