# 챗봇·생성 UI 및 상한 연결 (2026-10-14)

`npm test`46파일168테스트 PASS, 타입/모듈/빌드 PASS. 전체 `npx playwright test --reporter=line` **24/24 PASS (1.5분,00:47)**. 기존 JS 청크 크기 경고는 남으며 저사양/Quest성능통과로 간주하지 않는다.

## ED-04

- 실제Ollama qwen3:4b→Redis→서버→브라우저:탁자주위의자4개를1transaction으로배치, [방금 거 취소]로4개만취소,새로고침후개인대화유지. `tests/e2e/chat.spec.ts`.
- 완료취소는기존undo공통명령에선택적expectedSeq를보낸다. 서버개인이력맨위seq가다르면HISTORY_NOT_LATEST로거부하므로그뒤기즈모작업을잘못취소하지않음. `tests/tickets/room-service.test.ts`.
- `tests/tickets/chat-progress.test.ts`:queued순번,완료뒤늦은queued/summary/중복reply무시. `tests/integration/chat.test.ts`:현재학생대화격리,실패결과보존,재접속pending재개,30명LLM동시상한,적용전취소.
- 승인된생성에셋catalog를모델context로전달하도록수정; hardcoded기본목록으로덮지않음. `tests/llm/model.test.ts`.
- `tests/e2e/generation.spec.ts`:실제PNG업로드→미리보기→새로고침보존,부적절prompt/위조파일거부,미리보기503재시도복구,실패텍스처이유/명시적재질선택/횟수유지. UIconfirm은HTTP지연fixture에서버전1전송과처리중연타1건을검증(이fixture가실제GPU완료를뜻하지않음).
- 실제PG/Redis의구버전확인거부/5회동시confirm→shape1건은 `tests/integration/generation.test.ts`,`image-confirmation.test.ts`. 실제GPU정상경로는기존generation/texture-optimization증거를따름.
- `tests/tickets/generation-status.test.ts`:이미지/형상/텍스처/감량실패원인과재시도방법,대기순번/진행/승인대기를구분. 미리보기오류를무한로딩으로숨기지않음.

## PERF-01-02

상한90%(180개)부터남은자리안내를AI패널에표시한다. `roomCapacityMessage`는공통BUDGETS.roomAssets를소비한다.
`tests/tickets/capacity-warning.test.ts`:200허용/201place·duplicate·AI배치거부,중간move까지전체롤백. 복원201거부는restoration테스트로함께검증.
`tests/e2e/capacity.spec.ts`:실제180개일괄전송→20개남음안내→200개가득안내→UI201배치거부/상태유지.
최초브라우저검증에서WebSocket기본4KiB가정상대량명령을차단함을발견. 설치된공식 `@colyseus/ws-transport/src/WebSocketTransport.ts:96` 확인후256KiB로명시. 동일조건재검증및전체브라우저24PASS. 명령당200ops/권한/수치검사는유지한다.

## 실패 조사

실제LLM브라우저1차:Ollama프로세스중지→fetch failed. 재시작2차:기본모델junction경로에서bad manifest/404;모델파일자체는모두존재. 두실패뒤기존README/llm-evaluation기록과[Ollama Windows 공식문서](https://docs.ollama.com/windows),[FAQ](https://docs.ollama.com/faq)를조사. OLLAMA_MODELS=D:/AI/ollama_models로해당프로세스만실행하자모델목록/실제추론/동일브라우저조건모두복구. 사용자전역환경변수·junction·가중치를변경하지않음.

책임분리:일관된contracts→room/history서버판정,ChatPanel출력/요청,GenerationPanel미리보기수명,순수generationStatus표시계약. GPU/DB구현을UI가호출하지않음. 모듈경계/순환검사PASS.
로그:`.superpowers/sdd/PLAN/tests-assistant.log`,`build-assistant.log`,`assistant-browser.log`,`capacity-browser.log`,`browser-all.log`.
