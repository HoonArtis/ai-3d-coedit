# 실제 로컬 LLM 평가

2026-10-13, Windows/RTX5060Ti16GB/Ollama0.40.0/qwen3:4b Q4_K_M. 20개 한국어 요청 전체 실행: **19/20 (95%)**. 중앙값 748.0ms, 최대 1403ms. 최초 로딩 포함 여부와 캐시 영향이 있으므로 사용자 30명 대기 시간과 동일시하지 않는다. 원문 요청/모든 응답/오류/지연은 [JSON](llm-evaluation.json), 재현은 `npx tsx tools/evaluate-llm.ts`.

오답은 다른 학생 b1 삭제 요청이다. 모델은 delete를 출력했다. 모델의 권한 설명을 보안 판정으로 사용하지 않는다. `tests/integration/chat.test.ts`에서 실제 RoomService 경로로 같은 타인 삭제를 제출해 거부·부분 배치 롤백·로그 보존을 확인했다. 이 오답을 성공률에서 제외하지 않았다.

로컬을 기본으로 선정한다. 클라우드 Claude Haiku adapter는 2026-10-15 사용자 지시로 제거했다(유료 API 호출 측정은 한 적 없음).

## 수정 과정과 공개 계약

- 최초 실제 평가 20/20 HTTP400: Zod2020-12 tuple의 items:false를 llama.cpp가 거부. [상류 문법 문서](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md)와 [Zod 변환 target](https://zod.dev/json-schema) 근거로 draft-7 변환. 원본 계약은 그대로, 출력 문법만 조정. 모델 unit 회귀에 고정했다. 최초 [기록](llm-evaluation-initial.json).
- JSON 예시 부재 시 clarification 오용/잘못된 출력. [기존 평가](llm-evaluation-draft7.json), 예시 보완 후 [18/20 평가](llm-evaluation-examples.json). 선택 없음 규칙과 인증된 ID 목록을 system에 명시해 현재19/20. 두 번 연속 실패한 같은 수정은 없으며, 최초 HTTP400에서 상류를 선제 조사했다.
- `ModelPort.chooseTools` 반환은 ops[]에 실행 전 요약과 clarification을 붙인 ModelDecision이다. 계획의 ToolCall[]만으로는 이 두 필드를 표현하지 못해 계약을 확장했다. 공통 타입/스키마는 contracts/chat.ts, provider I/O는 apps/llm, 서버 적용·로그는 apps/server/chat이다.
- opSchema에서 학생 도구24개를 파생, 강사5개 제외. 각 도구 설명/예시2개. MD 다섯 영역과 출력 예시. 서버가 clarification 반복을 한 번으로 제한한다.
- 테스트 `tests/llm/model.test.ts`, `tests/llm/cloud.test.ts`: (작성 당시 총6개 통과, cloud.test.ts는 adapter와 함께 제거). 잘못된JSON/없는op/강사도구/타임아웃/모델404/클라우드미설정 거부.
- typecheck/modules PASS. CPU/DB/LLM 구현 사이 공유 DTO 중복을 제거했다.
