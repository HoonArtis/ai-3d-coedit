# 챗봇 통합 증거

2026-10-13 실제 PostgreSQL/Redis로 `tests/integration/chat.test.ts`4개 PASS.

- 인증된 RoomService 세션의 actor+room으로만 조회/쓰기. 입력 actor 위조 strict 거부. 다른 학생의 history는 분리.
- 탁자와 의자4개를 하나의 source:chat 명령으로 제출. seq1번 증가, undo1회로 전부 복구. 재요청 모델 재실행 없음.
- 타인 삭제 앞에 place가 포함되어도 전체롤백, 실패결과 PG보존. 강사도구 모델출력도 거부. 실제 LLM의 권한 오답은 서버에 같은 형태로 제출해 거부를 검증했다.
- 질문은 성공 명령 사이에 한 번만 허용. 30학생 병렬 요청을 별도LLM큐 동시2로 처리. 적용 전 취소와 명령 적용 시작은 DB 상태전환으로 경쟁을 판정한다. 취소는 이미 실행 중인 모델 프로세스를 강제종료하지 않지만 결과를 씬에 적용하지 않는다.
- 프로세스 재시작 복원: 최초 모델 입력/scene세대 PG보존. 새 coordinator와 변경된 현재씬에서도 최초 입력으로 재개. 동일 requestId 입력충돌거부, 씬복원으로 세대달라지면 적용거부.
- 대화 원문, 모델 원문, 요청ID, 최종ops/결과를 한 PG행으로 연계. 새로고침은 private history와 pending 복구를 요청한다.

`tests/e2e/chat.spec.ts`: 실제 Ollama qwen3:4b 워커 → Redis → Colyseus → 화면에서 의자4개 배치, undo1회, 새로고침 후대화 복원 PASS. 전체브라우저16개 PASS(21:47). 모델은 직접 씬을 바꾸지 않는다.

모듈 경계는 contracts(chat), packages/jobs(queue), apps/llm(provider), apps/server/chat(인증·저장·공통명령), ChatPanel(표시)이다. ModelPort를 server에서 직접 import하지 않고 큐공개계약으로 연결한다. typecheck/modules PASS.
