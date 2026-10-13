# 강사 이력·복원 검증 (2026-10-14)

- `npm test`: 43파일161테스트 PASS (00:22:32), `npm run typecheck`, `npm run check:modules`, `npm run build` PASS. 기존 JS 청크 크기 경고는 남음(약1.60MB); 실제 저사양 성능 판정으로 대체하지 않음.
- `npx playwright test tests/e2e/restoration.spec.ts tests/e2e/teacher-intervention.spec.ts --reporter=line`: Chromium2테스트 PASS10.2초. [화면](teacher-restoration.png).
- 상세 실행 로그 `.superpowers/sdd/PLAN/tests-restoration.log`, `restoration-browser.log`, `build-restoration.log`.

## 정상·실패 조건

`tests/domain/restoration.test.ts`: 소유권 보존, 새 revision/lastActor, whole snapshot 세대증가, 학생/다른방/미승인에셋/201개 거부 및 입력 불변.
`tests/tickets/restoration.test.ts`: 잠금 거부 원자성, 모든사용자의 관련undo/redo무효화, 현재없는객체의redo도전체복원시삭제, 위조historicalpayload/혼합명령거부,201개실패시history/lease보존, 살아있는강사선택lease보존.
`tests/integration/restoration.test.ts`: 실제 PostgreSQL 격리schema. seq역순cursor(조회사이에새명령추가해도중복/누락없음), 이전/이후내용, 다른강사/학생열람403,DB재시작후상태/무효화보존, 같은request재전송한번적용, 저장실패시세대/lease유지후동일request재시도.
`tests/tickets/camera.test.ts`: 살아있는포커스유지/삭제대상기본카메라복귀.
실제브라우저:12개객체복원은학생알림1건, snapshot복원세대증가/화면동기화, 삭제된선택속성패널제거/카메라기본거리복귀, 살아있는선택/줌포커스유지, 객체revision1복원, 존재하지않는revision명시오류/로컬변경없음. 강사강제해제중드래그회귀PASS.

## 계약과 모듈 경계

공통 `restore_object`/`restore_snapshot` 명령→DurableRoom직렬큐→저장소의권한있는기록해석→순수restoreScene→기존LockService→HistoryService무효화→PGcommit→방송. 클라이언트가 복원content를 보내는경로없음. 읽기HTTP는 teacher room권한검사후cursor조회뿐이며 씬수정없음.
Snapshot ID는 `seq-N` 또는 기존불변제출UUID. 전체복원은현재generation+1이며 원래owner유지, 새로운seq로기록. 전체복원은모든undo/redo초기화; 객체복원은해당객체포함transaction단위무효화. 복원자체는개인undo에추가하지않고 이력에서이전시점으로재복원한다.
UI는 HistoryPanel, 순수camera조정, useEditor이벤트처리로분리. OrbitControls누적damping은삭제된focus복귀직전에비우며, 살아있는focus에는카메라변경하지않음. 대상별알림아닌성공request당restored방송.

## 수정·재검증

의도한RED:restoreScene미구현,restore명령UNSUPPORTED,이력UI없음,살아있는선택lease가해제됨,삭제focus조정미구현. 모두위테스트에서GREEN확인. 이력fixture의cube표시명을잘못추정한1회실패는실제BUILTIN_LIBRARY명칭으로수정후PASS. 같은문제수정2회연속실패없어사례조사분기미발동. 서버실패를UI성공으로치환하지않음.
