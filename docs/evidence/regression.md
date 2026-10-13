# 통합 회귀 검증 — 2026-10-14

전체 단위·통합198개(.superpowers/sdd/PLAN/final-unit.log), 브라우저27개(final-browser-verified.log), 추가 실제 생성/복원 브라우저1개(generation-restore-browser.log) 통과. 별도의 최종 코드 리뷰에서 발견한 두 Important 결함도 재현 RED→GREEN으로 수정했다. 타입/모듈 검사를 병행했다.

| 예상 버그 | 실행 증거 |
|---|---|
| #1 강제해제 뒤 늦은 드래그 | room-service locks/preview, editor-collaboration·teacher-intervention 브라우저 |
| #2 강사 수정 뒤 개인undo | room-service undo teacher collision, teacher-intervention |
| #3 복원 뒤 낡은redo | integration/restoration durable restart HISTORY_EMPTY |
| #4 복원 중 생성 완료 | generation-finishing currentGeneration0/1; generation-restore.spec 실제 FBX→CPU Blender가 강사 seq0복원 후 완료: staleScene=true, 승인 후에도 씬0개 유지 |
| #5 복원200개 상한 | budgets/domain restoration 제한 및 capacity 브라우저201번째 배치 거부 |
| #6 챗봇 원자 경합 | room-service lock contention, integration/chat 다른소유자 삭제와 부분place 전체롤백 |
| #7 복원 알림 폭주 | restoration.spec 실제12개 객체 복원 방송1회, snapshot복원도 요청별1회 |
| #8 매프레임 이력 | room-service repeated previews, editor-gizmo 실제드래그1회undo |
| #9 단절된 잠금 | room-service disconnect heartbeat/session isolation, editor-collaboration 재접속 |
| #10 클라이언트시계 | 서버seq 중복/idempotence·persistence 재시작·selection 최신seq |
| #11 복제 소유권 | 공통domain duplicate 권한 및 editor-actions 복제 |
| #12 복원 낡은 선택 | restoration.spec 복원 후 선택 제거·카메라focus초기화 |

추가 수정과 원인:
- coordinator 종료 시 boolean guard가 기존 reconcile을 기다리지 않았다. singleFlight 공유promise로 바꾸고 진행중 호출/종료대기 회귀를 검증했다.
- VR pose-stop 뒤 지난seq가 재수신되면 아바타가 되살아났다. 연결별 lastSequence를 포즈 표시 상태와 분리해 실제 두 소켓 테스트로 거부/새seq수신 검증했다.
- useEditor는 낡은 snapshot으로 selection/previews를 지우던 경로를 최신seq조건 안으로 이동했다.
- 기즈모 브라우저 테스트의 고정pixel 가정은 실행환경에 따라 손잡이를 빗나갔다. 기존 회전/스케일 테스트의 카메라 투영 방식으로 바꿔 실드래그/undo 재검증했다.
- ChatService의 generation검사가 claimApply await보다 앞이라 복원 경합이 있었다. command.expectedGeneration을 서버 RoomService의 원자 적용 지점(실제 durable queue 안의 candidate 포함)에서 검사한다. generation/retexture 진입도 동일조건을 검사한다. 실제PG/Redis 테스트가 적용claim 중 작품세대변화를 재현하고 SCENE_RESTORED/객체미생성 확인했다.
- 업로드는 quota초과/충돌임에도 object store부터 썼다. SHA256을 먼저 계산하고 repository의 클래스 행 잠금/중복/한도 판정 이후 publish콜백을 실행한다. 동일5요청1회저장, quota/충돌0추가저장, DISK_FULL DB예약롤백/0차감 확인했다.
- 재생성은 고정seed42였다. jobId/version의 안정적 hashseed를 이미지 워커 인자로 전달해 동일버전재시도는 동일seed, redraw는 다른seed로 만들었다.

모듈화: expectedGeneration은 공통command계약이며 UI별권한분기를 추가하지 않았다. DB예약은 repository, bytes저장은 ObjectStore adapter, 생성 워커는 별도 프로세스에 남는다. singleFlight는 coordinator수명관리만 담당한다. diagnostic fixture는 tests/performance 아래에 두었다. 새로운 도메인→UI/DB 의존이나 순환은 없다.

실패 기록: generation-restore 첫실행은 선택된 학생 객체의 잠금 때문에 강사복원을 정상적으로 거부했다. 학생 선택을 해제한 뒤 같은 실제CPU 완료경합 테스트를 통과했다. GPU모델출력을 사용하는 6방 승인경로는 별도 class-session 증거로 구분하며 fixture검증을 GPU실측으로 합산하지 않는다.

최신 기본 미리보기 서버를 수정 코드로 재시작하고 http://127.0.0.1:4173 에서 서버연결/페이지오류0을 확인했다. 재시작 전 익명씬은 .cache/pre-restart-local-room.json에 백업했다. 실제 계정 작품은 PostgreSQL에 유지된다. 로컬 업로드/산출물 .data는 .gitignore에 포함하여 학생 데이터를 소스에 섞지 않는다.
