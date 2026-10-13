# 단계 큐 검증

2026-10-13 실제 Redis7.2 컨테이너(63799)/BullMQ6.3.14/ioredis6.0.0, Windows Node24.11.1.

`tests/integration/jobs.test.ts` 6개 PASS:
- 같은 입력 버전·room/actor/request/stage로 8회 동시 등록해 실행1회. 다른 입력은 JOB_INPUT_CONFLICT. 완료 작업을 adapter 재생성 후 재조회/재요청해 결과 유지.
- 형상·텍스처가 같은 gpu 큐를 공유하고 Redis 전역 concurrency1. 워커2개에도 최대동시1. LLM별도큐는 최대2. 워커 정상 재시작 후 제한 유지.
- 자식 워커 프로세스가 명령 실행 중 exit24로 종료. completed가 아님 확인 후 새 워커가 stalled lease를 회수하여 완료. 테스트는 lock/stalled400ms, 실제 기본30초. GPU 모델 추론 성공 시험은 GEN-03에서 별도 수행한다.
- 읽기 순서 사이에 완료되는 race를 barrier로 강제 재현. stale returnvalue=null을 읽던 결함 수정 후 완성 산출물 반환.
- 실패 이유 GPU_OOM 보존, 결과 없음, 최대2회 시도. 멈춤 작업도 maxStalledCount1로 한정. 부분 산출물은 반환 성공 전 게시하지 않는다.
- 완료/실패 상태에 낡은 running 이벤트를 합쳐도 되돌아가지 않는 acceptJobState 검증. 새 입력 버전만 새 상태로 시작.

## 책임과 한계

contracts/jobs.ts는 버전·단계·상태 계약, packages/jobs는 BullMQ adapter, apps/llm 및 후속 apps/workers는 실제 처리자다. API/worker는 공개 패키지만 사용하고 순수 명령 도메인은 Redis를 모른다. `npm run check:modules`, typecheck PASS.

jobId는 room/actor/요청/입력버전/단계의 SHA256으로 구분한다. 완료/실패 record는 idempotency를 위해 삭제하지 않는다. 운영 보존/아카이브는 별도 정책이 필요하다. BullMQ는 프로세스 장애 시 재시도할 수 있으므로 GPU 처리자는 전달된 executionId로 산출물 게시를 멱등 처리해야 한다. 큐 제한 시험을 실제 GPU subprocess/모델 설치 검증으로 주장하지 않는다.

GEN-01-03의 클라이언트 연결은 현재 Chat queued/summary/reply 통합으로 확인했다. 생성 단계 UI는 후속 GEN-02/ED-04에서 이 상태 계약을 소비한다. 테스트 파일명은 공통 fixture를 공유하도록 integration/jobs.test.ts로 모았다.

`tests/integration/worker-process.test.ts` PASS: 실제 자식 프로세스의 정상 종료/비정상exit3/타임아웃kill/취소kill을 확인했다. 종료 close 이벤트 전 슬롯을 반환하지 않으며 실패 시 partial stdout을 성공 산출물로 반환하지 않는다. GPU adapter는 runWorkerProcess를 사용하고 쉘/사용자 입력 명령을 받지 않는다.
