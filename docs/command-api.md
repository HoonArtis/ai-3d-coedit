# 명령 API (원본)

씬 상태를 바꾸는 유일한 길. 에디터(기즈모), 챗봇(도구 호출), 강사 패널이 모두 이 명령을 방 서버에 보낸다. 챗봇의 도구 목록도 이 표에서 그대로 만든다.

## 형식

```ts
type Command = {
  actor: string;                         // 사용자 ID
  source: "gizmo" | "chat" | "teacher";
  requestId: string;                     // 챗봇 요청 1회 = requestId 1개 = 트랜잭션 1개
  expectedGeneration?: number;           // 비동기 AI 요청이 읽은 작품 세대; 적용 시 다르면 거부
  ops: Op[];                             // 하나라도 실패하면 전체 롤백
};
```

서버 처리 순서: 권한 검사 → 잠금 확인 → seq 부여 → 방송 + 이력·되돌리기 스택 + 로그. 실패하면 거부 사유를 보낸 사람에게 돌려준다.

## 명령 목록

| 분류 | op | 직접 조작 | 챗봇 예시 | 권한 |
|---|---|---|---|---|
| 배치 | `place` | 드래그 앤 드롭 | "책상 하나 놔줘" | 학생 |
| | `generate` (큐) | 생성 버튼 | "고래 모양 벤치 만들어줘" | 학생, 횟수 제한 |
| | `upload_character` | 파일 업로드 | - | 학생 |
| 변형 | `move` · `rotate` · `scale` | 기즈모, 숫자 입력 | "왼쪽으로 2m", "두 배로" | 내 것만 |
| | `snap_to_ground` | 단축키 | "바닥에 붙여" | 내 것만 |
| 편집 | `duplicate` · `delete` · `rename` | 우클릭 메뉴 | "이거 3개 복사해" | 내 것만 |
| | `retexture` (큐) | 속성 패널 | "빨갛게 칠해줘" | 내 것만 |
| 자동 배치 | `arrange_around` | - | "탁자 주위에 의자 4개" | 내 것만 |
| | `align_row` · `distribute` | 다중 선택 메뉴 | "나무들 일렬로" | 내 것만 |
| | `scatter` | - | "꽃을 여기저기" | 내 것만 |
| | `place_on` | - | "책상 위에 컵" | 내 것만 |
| | `face_toward` | - | "의자들 무대 보게" | 내 것만 |
| | `arrange_nicely` | - | "어울리게 배치해줘", "알아서 정리해줘" | 내 것만. 의자→탁자 둘레, 벤치→나무 앞, 화분→탁자 위, 겹침 회피. 좌표는 `packages/placement/src/arrange.ts` |
| 조회 | `list` · `find` · `describe_scene` | 아웃라이너 | "내가 놓은 거 뭐 있어?" | 모두(상태 안 바꿈) |
| | `recommend` | 채팅 추천 목록의 [놓기]/[만들기] | "뭐 놓으면 어울려?", "이거랑 어울리는 거" | 모두(상태 안 바꿈, 단독). 결과 `suggestions` 최대 3개, 쓸 수 있는 에셋만. 규칙은 `relations.ts` |
| 카메라 | `focus` · `orbit` · `zoom` | 휠·우클릭 드래그 | "고래 쪽 보여줘" | 개인, 서버 안 거침 |
| 기록 | `undo` · `redo` | Ctrl+Z / Ctrl+Y | "방금 거 취소" | 개인 기준 |
| 잠금 | `lock` · `unlock` | 선택·해제 시 자동 | 챗봇 작업도 그 학생의 잠금 | 강사는 강제 해제 |
| 강사 | `force_unlock` · `approve_asset` · `restore_object` · `restore_snapshot` · `read_logs` | 강사 패널 | - | 강사 |

## 규칙

- 드래그 중에는 위치만 실시간 방송하고 기록하지 않는다. 놓는 순간 1건 기록.
- 자동 배치 op의 좌표는 서버(또는 공용 배치 모듈)가 계산한다. 클라이언트·LLM이 보낸 좌표를 그대로 믿지 않는다.
- 방 에셋 상한과 감량 수치는 `budgets.md`가 원본이다.
- 에셋 소유권: 만든 사람 소유. 강사의 수정은 소유권을 바꾸지 않고, 복제본은 복제한 사람 소유.

## 구현 계약 v1

공개 원본: `packages/contracts/src/index.ts`. 좌표는 m, 회전은 rad, 크기는 축별 배율 0.01~100. ID는 영문/숫자로 시작하는 1~80자(영문·숫자·언더바·하이픈). 명령에 `version: 1`(생략 시 1), `lockTokens: Record<objectId, token>`(생략 시 빈 값)를 추가한다. 카메라 op는 서버 명령 스키마에서 거부한다. 서버 인증 세션의 actor/source 검사를 통과해야 도메인에 전달한다. 순수 조회는 seq를 증가시키지 않는다.

`undo`의 선택적 `expectedSeq`는 챗봇 완료 카드가 원래 명령만 취소하도록 개인 이력 맨 위의 seq를 확인한다. 다른 작업이 뒤에 있으면 `HISTORY_NOT_LATEST`로 거부하며 아무 작업도 취소하지 않는다. 일반 Ctrl+Z/Y는 이 조건 없이 기존 개인 스택 순서를 따른다.


### 승인 결과 적용

`replace_asset {id, assetId, expectedRevision, expectedGeneration}`는 승인 라이브러리 결과를 기존 객체에 적용한다. 기존 id·소유자·이름·TRS를 유지하고 revision/lastActor만 갱신한다. 학생은 자기 객체의 선택 잠금이 필요하며, revision 또는 방 generation이 달라졌으면 `STALE_RETEXTURE`로 원자 거부한다. 공통 durable 명령 기록·개인 undo/redo를 그대로 사용한다.

`retexture {id,prompt}`는 해당 객체의 권한·잠금을 확인한 뒤 원본 shape와 요청 당시 revision/generation을 보관한다. 공식 TG2MV 경로에서 기존 기하와 새 재질 설명으로 텍스처를 생성하고 감량/승인으로 진행한다. 새 형상이나 참고 이미지를 만들지 않는다. 승인만으로 현재 씬을 자동 변경하지 않으며 승인 결과 카드에서 명시적으로 적용한다. 변경된 객체/복원된 방이면 라이브러리에만 남긴다. 재질 변경은 기존 생성 사용량 1회에 포함된다.
