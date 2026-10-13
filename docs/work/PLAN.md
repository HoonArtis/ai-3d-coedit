# AI 공간 꾸미기 Implementation Plan — PLAN-001

> **For agentic workers:** 구현 시 `superpowers:executing-plans`로 티켓별 실행한다. 병렬 에이전트 실행은 이 장부 생성만으로 지정하지 않는다. 체크박스로 진행을 기록한다.

**Goal:** 기존 기획을 1인 에디터부터 협업·AI·생성·웹VR까지 추적 가능한 플랜 → 태스크 → 티켓으로 구현한다.

**Architecture:** 클라이언트는 명령을 보내고 서버가 권한·잠금·순서를 판정한다. 공통 계약과 순수 도메인을 앱에서 분리하고, DB·LLM·GPU는 공개 adapter로 연결한다. 원본 요구사항을 변경하지 않고 실행 책임과 의존성을 나눈다.

**Tech Stack:** 원본의 React/R3F/three.js, Node.js, PostgreSQL, Redis/BullMQ, GPU 파이프라인. Colyseus는 ROOM-01 실험 후 채택했다. TypeScript·npm workspaces·Vite·Vitest·Playwright·Python pytest는 이번 계획의 제안이며 버전과 라이선스는 도입 티켓에서 확인한다.

**Spec:** [CLAUDE.md](../../CLAUDE.md), 아래 요구사항 원본 9개. 작성일 2026-10-13.

## Global Constraints

- 방당 학생 최대 5인, 강사는 정원 외, VR 감상자는 정원 포함.
- 학생은 자기 에셋만, 강사는 전체. 챗봇은 그 학생의 권한을 그대로 따른다.
- 모든 씬 변경은 `{actor, source, requestId, ops[]}` 경로이며 권한 검사 → 잠금 확인 → seq 부여를 거친다.
- 챗봇 요청 1회는 명령 1건이며 하나라도 실패하면 전체 롤백, 되돌리기도 1단위다.
- LLM은 도구와 인자만 고르고 좌표·겹침 계산은 코드가 담당한다.
- 방 에셋 상한 200개, 생성 에셋 약 5천 삼각형, 방 전체 최대 약 100만 삼각형, 텍스처 1024 KTX2.
- VR 전체 삼각형 50만 이하, draw call 150 이하, 에셋 약 2,500 삼각형, 아바타 1인 1만 삼각형 이하.
- 편집 내장 그래픽 30fps, Quest 2 감상 72fps는 실제 장치 검증 목표다.
- 생성은 학생 이미지 확인과 강사 승인 단계를 거친다. 제한 의존물과 미확인 항목은 원본 기준으로 처리한다.
- 주기적 모듈화 검증은 CLAUDE.md의 필수 규칙이다. 티켓 시작·완료, 태스크 완료, 공용 계약 변경 직후에 수행한다.

## Review Focus

| 실패 조건 | 기대 행동 | 담당 티켓 |
|---|---|---|
| 재접속·재시도로 같은 requestId 중복 전송 | 한 번만 확정·동일 결과 반환 | ROOM-02, ROOM-05 |
| 인증 actor/수업 ID 위조 또는 LLM 출력 주입 | 세션 권한 유지·교차 수업 접근 거부 | CORE-01, ACC-01, AI-03 |
| 저장 후 응답 전 프로세스 종료 | 재시작 후 확정 seq 복구·중복 적용 없음 | ROOM-05 |
| GPU 실패·이미지 재확인 경합 | 상태/차감 중복 방지·명시적 실패 | GEN-01, GEN-02, GEN-03 |
| 잘못된 transform·손상 업로드 | NaN/무한대 거부·캐릭터 대체 | CORE-01, GEN-06 |

## 장부 사용법

- **플랜**: 전체 목표·범위·순서. **태스크**: 원본 문서별 책임과 통합 완료 기준. **티켓**: 독립적으로 구현하고 검증할 작업 단위.
- 상태 원본은 각 티켓의 `상태` 필드다. 초기에는 전부 `todo`이며 아래 목록은 순서와 연결을 보여 준다.
- 상태: `todo → doing → review → done` (진행 단계는 구현 → 검증 → 수정/사례 조사 → 재검증으로 별도 기록). 실제 차단은 `blocked`, 범위에서 명시적으로 제외한 것은 `deferred`. 선행 미완료는 일반 대기이며 즉시 blocked로 바꾸지 않는다.
- 선행 티켓이 done이고 외부 실행 조건을 갖추면 착수한다. 구현 일부만 성공하면 done으로 표시하지 않는다.
- 완료는 코드 작성이 아니라 완료 조건 + 검증 증거 + 모듈화 검토를 모두 충족한 상태다.
- 목/fixture 검증과 실제 모델·기기 검증을 구분한다. 환경 미보유·계약 필요 항목을 사용자에게 받은 것으로 가정하지 않는다.
- 기존 37개 큰 티켓은 `split`인 분할 이력으로 보존한다. 실행과 진행률은 `ED-02-01` 형태의 세부 티켓만 기준으로 한다.
- [WORKFLOW.md](WORKFLOW.md)의 검증·수정·재검증 및 2회 연속 실패 시 사례 조사 규칙을 모든 실행 티켓에 적용한다.
- `ticket-map.json`은 ID·의존관계 인덱스이고 상태는 티켓 Markdown만 원본이다. 변경 후 `py docs/work/check_work.py`로 구조를 확인한다.
- 이 장부는 로컬 문서다. GitHub Issue 생성·커밋·푸시는 별도 실행이며 이번 작업에서는 하지 않는다.

## 구현 파일 구조 (제안)

```text
apps/web/src/{editor,chat,generation,teacher,accounts,characters,vr}
apps/server/src/{rooms,accounts,storage,jobs,generation,teacher,chat,vr}
apps/llm/{src,prompts}
apps/workers/src/                 # Node 큐 실행 및 외부 워커 연결
packages/contracts/src/           # 타입·검증·예산; 앱에 의존하지 않음
packages/domain/src/              # 순수 명령 판정/상태 전이
packages/placement/src/           # 결정적 공간 계산
workers/gpu/{pipeline,adapters,tests}
infra/migrations/
tests/{contracts,domain,architecture,placement,server,integration,e2e,performance,llm}
docs/{decisions,evidence}/
tools/check-modules.mjs
```

도메인 상태 전이는 서버가 호출한다. 배치 모듈이 만든 ops도 같은 판정 경로로 들어간다. 패키지 공개 API는 `src/index.ts`에서 내보내며 다른 모듈 내부 파일에 직접 의존하지 않는다. Python에는 버전 있는 JSON 계약으로 예산/작업 데이터를 전달한다.

## 태스크와 요구사항 매핑

| 태스크 | 영역 | 원본 | 티켓 수 |
|---|---|---|---|
| [T01](tasks/T01.md) | 공통 기반·명령 계약 | [docs/command-api.md](../../docs/command-api.md) | 11 |
| [T02](tasks/T02.md) | 에디터 프론트엔드 | [docs/roles/editor-frontend.md](../../docs/roles/editor-frontend.md) | 20 |
| [T03](tasks/T03.md) | 방 서버·동기화·저장 | [docs/roles/room-server.md](../../docs/roles/room-server.md) | 25 |
| [T04](tasks/T04.md) | 개인 챗봇·자동 배치 | [docs/roles/chatbot.md](../../docs/roles/chatbot.md) | 13 |
| [T05](tasks/T05.md) | GPU 생성·큐·캐릭터 | [docs/roles/generation-gpu.md](../../docs/roles/generation-gpu.md) | 22 |
| [T06](tasks/T06.md) | 강사·계정·승인·로그 | [docs/roles/teacher-accounts.md](../../docs/roles/teacher-accounts.md) | 16 |
| [T07](tasks/T07.md) | 웹VR·굽기·아바타 | [docs/roles/webxr.md](../../docs/roles/webxr.md) | 11 |
| [T08](tasks/T08.md) | 성능 예산·통합 검증 | [docs/budgets.md](../../docs/budgets.md) | 10 |
| [T09](tasks/T09.md) | 의존물·선정·판매 검증 | [docs/licenses.md](../../docs/licenses.md) | 9 |

## 진행 순서

원본의 1주 일정은 목표이며 아래는 완료를 보장하는 날짜 약속이 아니다. 아래 짧은 ID는 분할 전 작업 묶음을 설명하며 실제 착수 순서는 실행 티켓의 선행 관계를 따른다. 기본은 보수적인 순차 진행이며 독립 실행 가능 여부는 공개 계약으로 확인한다.

1. **착수:** LIC-01 → CORE-01 → CORE-02/CORE-03/PERF-01. 라이선스 확인과 명령 경계를 먼저 마련한다.
2. **1인 편집:** ED-01 → ED-02. 임시 transport도 공통 명령 도메인을 사용한다.
3. **협업 기반:** ROOM-01 → ROOM-02 → ROOM-03 → ROOM-04 → ROOM-05, ED-03. 잠정 서버 선택을 검증한다.
4. **AI·계정·큐:** AI-01/AI-02, ACC-01, GEN-01을 준비하고 AI-03으로 연결한다. 모델/하드웨어 조사는 LIC-02에서 미리 진행한다.
5. **생성:** GEN-02 → GEN-03 → GEN-05 → ACC-03. GEN-04는 텍스처 경로를 추가한다. ED-04, ACC-02/ACC-04로 학생·강사 흐름을 완성한다.
6. **VR:** VR-01 → VR-02 → VR-03, PERF-02. PICO 미확인은 실제 장치 결과로만 해소한다.
7. **확장·통합:** ROOM-06 → ED-05 → ACC-05, GEN-06, PERF-03. 복원 관련 회귀는 기능 구현 시부터 검증한다.
8. **판매 전:** LIC-03. 1주 테스트 완료와 판매 가능 판정을 구분한다.

시간이 모자라면 원본대로 캐릭터 → 강사 이력/복원 → 웹VR → 텍스처 순으로 조정하되, 자동으로 잘라내지 말고 범위 변경을 기록한다. 핵심 1~5를 우선한다. VR이나 복원을 제외하면 PERF-03의 해당 시나리오는 제외 근거를 명시하고 전체 기획 완료라고 표현하지 않는다.

## 전체 실행 티켓 (137개)

기존 37개 ID는 분할 이력이다. 아래 실행 티켓만 완료율에 포함한다. 요구사항 원본 9개를 유지하며 제품 범위를 늘리지 않고 구현 단위를 나눴다.

| 티켓 | 태스크 | 단일 결과 | 선행 |
|---|---|---|---|
| [CORE-01-01](tickets/CORE-01-01.md) | [T01](tasks/T01.md) | 개발·테스트 실행 환경 | LIC-01-03 |
| [CORE-01-02](tickets/CORE-01-02.md) | [T01](tasks/T01.md) | 명령 봉투·세션 컨텍스트 계약 | LIC-01-03, CORE-01-01 |
| [CORE-01-03](tickets/CORE-01-03.md) | [T01](tasks/T01.md) | op별 인자 검증 계약 | LIC-01-03, CORE-01-02 |
| [CORE-01-04](tickets/CORE-01-04.md) | [T01](tasks/T01.md) | 씬·응답·이벤트·transport 계약 | LIC-01-03, CORE-01-03 |
| [CORE-02-01](tickets/CORE-02-01.md) | [T01](tasks/T01.md) | 생성·복제의 소유권 상태 전이 | CORE-01-04, PERF-01-01 |
| [CORE-02-02](tickets/CORE-02-02.md) | [T01](tasks/T01.md) | 변형 명령의 순수 상태 전이 | CORE-01-04, PERF-01-01, CORE-02-01 |
| [CORE-02-03](tickets/CORE-02-03.md) | [T01](tasks/T01.md) | 삭제·이름 변경·조회 처리 | CORE-01-04, PERF-01-01, CORE-02-02 |
| [CORE-02-04](tickets/CORE-02-04.md) | [T01](tasks/T01.md) | 여러 op의 원자 상태 계산 | CORE-01-04, PERF-01-01, CORE-02-03 |
| [CORE-03-01](tickets/CORE-03-01.md) | [T01](tasks/T01.md) | 패키지 공개 경계 검사 | CORE-01-04 |
| [CORE-03-02](tickets/CORE-03-02.md) | [T01](tasks/T01.md) | 순환 의존 검사 | CORE-01-04, CORE-03-01 |
| [CORE-03-03](tickets/CORE-03-03.md) | [T01](tasks/T01.md) | 검증 명령과 완료 절차 연결 | CORE-01-04, CORE-03-02 |
| [ED-01-01](tickets/ED-01-01.md) | [T02](tasks/T02.md) | 빈 템플릿·그리드·패널 화면 | CORE-01-04 |
| [ED-01-02](tickets/ED-01-02.md) | [T02](tasks/T02.md) | 마우스 카메라 조작 | CORE-01-04, ED-01-01 |
| [ED-01-03](tickets/ED-01-03.md) | [T02](tasks/T02.md) | 개인 카메라 명령 | CORE-01-04, ED-01-02 |
| [ED-02-01](tickets/ED-02-01.md) | [T02](tasks/T02.md) | 라이브러리 드래그 배치 | ED-01-03, CORE-02-04 |
| [ED-02-02](tickets/ED-02-02.md) | [T02](tasks/T02.md) | 이동 기즈모 | ED-01-03, CORE-02-04, ED-02-01 |
| [ED-02-03](tickets/ED-02-03.md) | [T02](tasks/T02.md) | 회전 기즈모 | ED-01-03, CORE-02-04, ED-02-02 |
| [ED-02-04](tickets/ED-02-04.md) | [T02](tasks/T02.md) | 크기 기즈모 | ED-01-03, CORE-02-04, ED-02-03 |
| [ED-02-05](tickets/ED-02-05.md) | [T02](tasks/T02.md) | 속성 숫자 입력 동기화 | ED-01-03, CORE-02-04, ED-02-04 |
| [ED-02-06](tickets/ED-02-06.md) | [T02](tasks/T02.md) | 복제·삭제·이름 메뉴 | ED-01-03, CORE-02-04, ED-02-05 |
| [ED-02-07](tickets/ED-02-07.md) | [T02](tasks/T02.md) | 바닥 스냅 조작 | ED-01-03, CORE-02-04, ED-02-06, AI-01-01 |
| [ED-03-01](tickets/ED-03-01.md) | [T02](tasks/T02.md) | 네트워크 transport와 5창 반영 | ED-02-07, ROOM-02-04, ROOM-03-04, ROOM-04-04 |
| [ED-03-02](tickets/ED-03-02.md) | [T02](tasks/T02.md) | 선택 잠금과 색 테두리 | ED-02-07, ROOM-02-04, ROOM-03-04, ROOM-04-04, ED-03-01 |
| [ED-03-03](tickets/ED-03-03.md) | [T02](tasks/T02.md) | 강제 해제 시 드래그 취소 | ED-02-07, ROOM-02-04, ROOM-03-04, ROOM-04-04, ED-03-02 |
| [ED-03-04](tickets/ED-03-04.md) | [T02](tasks/T02.md) | 개인 undo/redo UI | ED-02-07, ROOM-02-04, ROOM-03-04, ROOM-04-04, ED-03-03 |
| [ED-04-01](tickets/ED-04-01.md) | [T02](tasks/T02.md) | 개인 대화와 실행 요약 패널 | ED-03-04, AI-03-04, GEN-02-04 |
| [ED-04-02](tickets/ED-04-02.md) | [T02](tasks/T02.md) | LLM 대기 순번 표시 | ED-03-04, AI-03-04, GEN-02-04, ED-04-01 |
| [ED-04-03](tickets/ED-04-03.md) | [T02](tasks/T02.md) | 이미지 확인·다시 그리기 UI | ED-03-04, AI-03-04, GEN-02-04, ED-04-02 |
| [ED-04-04](tickets/ED-04-04.md) | [T02](tasks/T02.md) | 3D 생성 단계·횟수·오류 표시 | ED-03-04, AI-03-04, GEN-02-04, ED-04-03 |
| [ED-05-01](tickets/ED-05-01.md) | [T02](tasks/T02.md) | 복원된 씬의 선택 정리 | ED-03-04, ROOM-06-05 |
| [ED-05-02](tickets/ED-05-02.md) | [T02](tasks/T02.md) | 복원된 씬의 포커스 정리 | ED-03-04, ROOM-06-05, ED-05-01 |
| [ROOM-01-01](tickets/ROOM-01-01.md) | [T03](tasks/T03.md) | 동기화 후보 요구사항 비교 | CORE-01-04 |
| [ROOM-01-02](tickets/ROOM-01-02.md) | [T03](tasks/T03.md) | 방 adapter 최소 재현 | CORE-01-04, ROOM-01-01 |
| [ROOM-01-03](tickets/ROOM-01-03.md) | [T03](tasks/T03.md) | 서버 선정 근거·계약 확정 | CORE-01-04, ROOM-01-02 |
| [ROOM-02-01](tickets/ROOM-02-01.md) | [T03](tasks/T03.md) | 수업·방 입장과 정원 | ROOM-01-03, CORE-02-04 |
| [ROOM-02-02](tickets/ROOM-02-02.md) | [T03](tasks/T03.md) | 인증 주체 명령 접수 | ROOM-01-03, CORE-02-04, ROOM-02-01 |
| [ROOM-02-03](tickets/ROOM-02-03.md) | [T03](tasks/T03.md) | 요청 ID 중복 방지 | ROOM-01-03, CORE-02-04, ROOM-02-02 |
| [ROOM-02-04](tickets/ROOM-02-04.md) | [T03](tasks/T03.md) | 서버 순번·방송·재접속 | ROOM-01-03, CORE-02-04, ROOM-02-03 |
| [ROOM-03-01](tickets/ROOM-03-01.md) | [T03](tasks/T03.md) | 단일 객체 잠금 획득·해제 | ROOM-02-04 |
| [ROOM-03-02](tickets/ROOM-03-02.md) | [T03](tasks/T03.md) | 여러 대상 잠금 원자 획득 | ROOM-02-04, ROOM-03-01 |
| [ROOM-03-03](tickets/ROOM-03-03.md) | [T03](tasks/T03.md) | 단절·하트비트 잠금 회수 | ROOM-02-04, ROOM-03-02 |
| [ROOM-03-04](tickets/ROOM-03-04.md) | [T03](tasks/T03.md) | 강제 해제·낡은 쓰기 거부 | ROOM-02-04, ROOM-03-03 |
| [ROOM-04-01](tickets/ROOM-04-01.md) | [T03](tasks/T03.md) | 트랜잭션 확정과 요청 단위 이력 | ROOM-03-04 |
| [ROOM-04-02](tickets/ROOM-04-02.md) | [T03](tasks/T03.md) | 개인 undo 권한·역명령 | ROOM-03-04, ROOM-04-01 |
| [ROOM-04-03](tickets/ROOM-04-03.md) | [T03](tasks/T03.md) | 개인 redo와 분기 무효화 | ROOM-03-04, ROOM-04-02 |
| [ROOM-04-04](tickets/ROOM-04-04.md) | [T03](tasks/T03.md) | 드래그 프리뷰와 이력 분리 | ROOM-03-04, ROOM-04-03 |
| [ROOM-05-01](tickets/ROOM-05-01.md) | [T03](tasks/T03.md) | 방 저장 스키마·repository 계약 | ROOM-04-04 |
| [ROOM-05-02](tickets/ROOM-05-02.md) | [T03](tasks/T03.md) | 내구 커밋과 성공 방송 순서 | ROOM-04-04, ROOM-05-01 |
| [ROOM-05-03](tickets/ROOM-05-03.md) | [T03](tasks/T03.md) | 서버 재시작 복구 | ROOM-04-04, ROOM-05-02 |
| [ROOM-05-04](tickets/ROOM-05-04.md) | [T03](tasks/T03.md) | 저장 직후 크래시·재전송 | ROOM-04-04, ROOM-05-03 |
| [ROOM-05-05](tickets/ROOM-05-05.md) | [T03](tasks/T03.md) | 제출 스냅샷 저장 | ROOM-04-04, ROOM-05-04 |
| [ROOM-06-01](tickets/ROOM-06-01.md) | [T03](tasks/T03.md) | 에셋 이력 조회 | ROOM-05-05 |
| [ROOM-06-02](tickets/ROOM-06-02.md) | [T03](tasks/T03.md) | 에셋 단위 복원 | ROOM-05-05, ROOM-06-01 |
| [ROOM-06-03](tickets/ROOM-06-03.md) | [T03](tasks/T03.md) | 방 스냅샷 복원·세대 증가 | ROOM-05-05, ROOM-06-02 |
| [ROOM-06-04](tickets/ROOM-06-04.md) | [T03](tasks/T03.md) | 복원 후 undo/redo 무효화 | ROOM-05-05, ROOM-06-03 |
| [ROOM-06-05](tickets/ROOM-06-05.md) | [T03](tasks/T03.md) | 요청 단위 복원 알림 | ROOM-05-05, ROOM-06-04 |
| [AI-01-01](tickets/AI-01-01.md) | [T04](tasks/T04.md) | 바닥·겹침 계산 | CORE-02-04 |
| [AI-01-02](tickets/AI-01-02.md) | [T04](tasks/T04.md) | 원형 자동 배치 | CORE-02-04, AI-01-01 |
| [AI-01-03](tickets/AI-01-03.md) | [T04](tasks/T04.md) | 행 정렬·균등 분배 | CORE-02-04, AI-01-02 |
| [AI-01-04](tickets/AI-01-04.md) | [T04](tasks/T04.md) | 시드 기반 흩뿌리기 | CORE-02-04, AI-01-03 |
| [AI-01-05](tickets/AI-01-05.md) | [T04](tasks/T04.md) | 위에 놓기·방향 맞추기 | CORE-02-04, AI-01-04 |
| [AI-02-01](tickets/AI-02-01.md) | [T04](tasks/T04.md) | op 기반 도구 정의 | AI-01-05, LIC-02-03 |
| [AI-02-02](tickets/AI-02-02.md) | [T04](tasks/T04.md) | 학생 MD 시스템 프롬프트 | AI-01-05, LIC-02-03, AI-02-01 |
| [AI-02-03](tickets/AI-02-03.md) | [T04](tasks/T04.md) | 로컬·클라우드 모델 adapter | AI-01-05, LIC-02-03, AI-02-02 |
| [AI-02-04](tickets/AI-02-04.md) | [T04](tasks/T04.md) | 20문항 모델 평가·선정 | AI-01-05, LIC-02-03, AI-02-03 |
| [AI-03-01](tickets/AI-03-01.md) | [T04](tasks/T04.md) | 학생별 대화 세션 | AI-02-04, ROOM-04-04, GEN-01-04, ACC-01-05 |
| [AI-03-02](tickets/AI-03-02.md) | [T04](tasks/T04.md) | LLM 큐·대기 순번 | AI-02-04, ROOM-04-04, GEN-01-04, ACC-01-05, AI-03-01 |
| [AI-03-03](tickets/AI-03-03.md) | [T04](tasks/T04.md) | 도구 결과를 단일 명령으로 실행 | AI-02-04, ROOM-04-04, GEN-01-04, ACC-01-05, AI-03-02 |
| [AI-03-04](tickets/AI-03-04.md) | [T04](tasks/T04.md) | 대화·명령 결과 로그 저장 | AI-02-04, ROOM-04-04, GEN-01-04, ACC-01-05, AI-03-03 |
| [GEN-01-01](tickets/GEN-01-01.md) | [T05](tasks/T05.md) | 단계별 작업 등록·중복 방지 | CORE-01-04, LIC-01-03 |
| [GEN-01-02](tickets/GEN-01-02.md) | [T05](tasks/T05.md) | GPU 직렬 처리·LLM 별도 제한 | CORE-01-04, LIC-01-03, GEN-01-01 |
| [GEN-01-03](tickets/GEN-01-03.md) | [T05](tasks/T05.md) | 단계 상태·대기 순번 이벤트 | CORE-01-04, LIC-01-03, GEN-01-02 |
| [GEN-01-04](tickets/GEN-01-04.md) | [T05](tasks/T05.md) | 실패·타임아웃·재시도 회수 | CORE-01-04, LIC-01-03, GEN-01-03 |
| [GEN-02-01](tickets/GEN-02-01.md) | [T05](tasks/T05.md) | 글 이미지 생성·그림 반입 | GEN-01-04, ACC-01-05, LIC-02-03 |
| [GEN-02-02](tickets/GEN-02-02.md) | [T05](tasks/T05.md) | 부적절 입력 필터 | GEN-01-04, ACC-01-05, LIC-02-03, GEN-02-01 |
| [GEN-02-03](tickets/GEN-02-03.md) | [T05](tasks/T05.md) | 수업별 생성 횟수 적용 | GEN-01-04, ACC-01-05, LIC-02-03, GEN-02-02 |
| [GEN-02-04](tickets/GEN-02-04.md) | [T05](tasks/T05.md) | 이미지 확인 버전과 재생성 | GEN-01-04, ACC-01-05, LIC-02-03, GEN-02-03 |
| [GEN-03-01](tickets/GEN-03-01.md) | [T05](tasks/T05.md) | 배경 제거 adapter | GEN-02-04, LIC-02-03 |
| [GEN-03-02](tickets/GEN-03-02.md) | [T05](tasks/T05.md) | TripoSG 형상 실행 | GEN-02-04, LIC-02-03, GEN-03-01 |
| [GEN-03-03](tickets/GEN-03-03.md) | [T05](tasks/T05.md) | 형상 GPU 실행·오류 실측 | GEN-02-04, LIC-02-03, GEN-03-02 |
| [GEN-04-01](tickets/GEN-04-01.md) | [T05](tasks/T05.md) | MV-Adapter 텍스처 실행 | GEN-03-03 |
| [GEN-04-02](tickets/GEN-04-02.md) | [T05](tasks/T05.md) | retexture 작업 연결 | GEN-03-03, GEN-04-01 |
| [GEN-04-03](tickets/GEN-04-03.md) | [T05](tasks/T05.md) | 재질 프리셋 차선책 | GEN-03-03, GEN-04-02 |
| [GEN-05-01](tickets/GEN-05-01.md) | [T05](tasks/T05.md) | 데스크톱 메시 감량 | GEN-03-03, PERF-01-01 |
| [GEN-05-02](tickets/GEN-05-02.md) | [T05](tasks/T05.md) | 1024 KTX2 변환 | GEN-03-03, GEN-05-01, PERF-01-01 |
| [GEN-05-03](tickets/GEN-05-03.md) | [T05](tasks/T05.md) | 산출물 저장·manifest 등록 | GEN-03-03, GEN-05-02, PERF-01-01 |
| [GEN-05-04](tickets/GEN-05-04.md) | [T05](tasks/T05.md) | 승인 대기·세대 검증 | GEN-03-03, GEN-05-03, PERF-01-01 |
| [GEN-06-01](tickets/GEN-06-01.md) | [T05](tasks/T05.md) | 캐릭터 업로드 검증·FBX 변환 | GEN-05-04, VR-02-05 |
| [GEN-06-02](tickets/GEN-06-02.md) | [T05](tasks/T05.md) | 리깅·애니메이션 보존·감량 | GEN-05-04, VR-02-05, GEN-06-01 |
| [GEN-06-03](tickets/GEN-06-03.md) | [T05](tasks/T05.md) | 맵 대기 애니메이션 | GEN-05-04, VR-02-05, GEN-06-02 |
| [GEN-06-04](tickets/GEN-06-04.md) | [T05](tasks/T05.md) | VR 캐릭터 연결·기본 대체 | GEN-05-04, VR-02-05, GEN-06-03 |
| [ACC-01-01](tickets/ACC-01-01.md) | [T06](tasks/T06.md) | 강사 인증·세션 권한 | ROOM-02-04 |
| [ACC-01-02](tickets/ACC-01-02.md) | [T06](tasks/T06.md) | 수업·방 생성 | ROOM-02-04, ACC-01-01 |
| [ACC-01-03](tickets/ACC-01-03.md) | [T06](tasks/T06.md) | 학생 계정 일괄 발급 | ROOM-02-04, ACC-01-02 |
| [ACC-01-04](tickets/ACC-01-04.md) | [T06](tasks/T06.md) | 방 코드·학생 ID 입장 | ROOM-02-04, ACC-01-03 |
| [ACC-01-05](tickets/ACC-01-05.md) | [T06](tasks/T06.md) | 작품 계정 귀속·재입장 | ROOM-02-04, ACC-01-04 |
| [ACC-02-01](tickets/ACC-02-01.md) | [T06](tasks/T06.md) | 조별 방 목록·썸네일 | ACC-01-05, ROOM-05-05 |
| [ACC-02-02](tickets/ACC-02-02.md) | [T06](tasks/T06.md) | 대시보드에서 강사 입장 | ACC-01-05, ROOM-05-05, ACC-02-01 |
| [ACC-02-03](tickets/ACC-02-03.md) | [T06](tasks/T06.md) | 학생 생성 한도 설정 | ACC-01-05, ROOM-05-05, ACC-02-02 |
| [ACC-03-01](tickets/ACC-03-01.md) | [T06](tasks/T06.md) | 승인·거절 서버 판정 | ACC-01-05, GEN-05-04 |
| [ACC-03-02](tickets/ACC-03-02.md) | [T06](tasks/T06.md) | 미승인 산출물 접근 제한 | ACC-01-05, GEN-05-04, ACC-03-01 |
| [ACC-03-03](tickets/ACC-03-03.md) | [T06](tasks/T06.md) | 승인함 UI와 배치 연결 | ACC-01-05, GEN-05-04, ACC-03-02 |
| [ACC-04-01](tickets/ACC-04-01.md) | [T06](tasks/T06.md) | 학생별 로그 조회 권한·페이지 | ACC-02-03, AI-03-04 |
| [ACC-04-02](tickets/ACC-04-02.md) | [T06](tasks/T06.md) | 로그 열람 UI | ACC-02-03, AI-03-04, ACC-04-01 |
| [ACC-05-01](tickets/ACC-05-01.md) | [T06](tasks/T06.md) | 에셋 이력 선택 UI | ACC-02-03, ROOM-06-05, ED-05-02 |
| [ACC-05-02](tickets/ACC-05-02.md) | [T06](tasks/T06.md) | 에셋 복원 실행 UI | ACC-02-03, ROOM-06-05, ED-05-02, ACC-05-01 |
| [ACC-05-03](tickets/ACC-05-03.md) | [T06](tasks/T06.md) | 방 스냅샷 복원 UI | ACC-02-03, ROOM-06-05, ED-05-02, ACC-05-02 |
| [VR-01-01](tickets/VR-01-01.md) | [T07](tasks/T07.md) | 스냅샷 굽기 작업 등록 | GEN-05-04, ROOM-05-05, PERF-01-01 |
| [VR-01-02](tickets/VR-01-02.md) | [T07](tasks/T07.md) | VR LOD 감량 | GEN-05-04, ROOM-05-05, VR-01-01, PERF-01-01 |
| [VR-01-03](tickets/VR-01-03.md) | [T07](tasks/T07.md) | 아틀라스·정적 병합·KTX2 | GEN-05-04, ROOM-05-05, VR-01-02, PERF-01-01 |
| [VR-01-04](tickets/VR-01-04.md) | [T07](tasks/T07.md) | VR 산출물 공개 | GEN-05-04, ROOM-05-05, VR-01-03, PERF-01-01 |
| [VR-02-01](tickets/VR-02-01.md) | [T07](tasks/T07.md) | HTTPS·사용자 동작 VR 진입 | VR-01-04, ACC-01-05, LIC-02-03 |
| [VR-02-02](tickets/VR-02-02.md) | [T07](tasks/T07.md) | 읽기 전용 스냅샷 뷰어 | VR-01-04, ACC-01-05, LIC-02-03, VR-02-01 |
| [VR-02-03](tickets/VR-02-03.md) | [T07](tasks/T07.md) | 텔레포트 이동 | VR-01-04, ACC-01-05, LIC-02-03, VR-02-02 |
| [VR-02-04](tickets/VR-02-04.md) | [T07](tasks/T07.md) | 감상 방 정원·포즈 동기화 | VR-01-04, ACC-01-05, LIC-02-03, VR-02-03 |
| [VR-02-05](tickets/VR-02-05.md) | [T07](tasks/T07.md) | 기본 머리·손 아바타 | VR-01-04, ACC-01-05, LIC-02-03, VR-02-04 |
| [VR-03-01](tickets/VR-03-01.md) | [T07](tasks/T07.md) | Quest 실기기 동작 확인 | VR-02-05 |
| [VR-03-02](tickets/VR-03-02.md) | [T07](tasks/T07.md) | PICO 중국 내수판 지원 확인 | VR-02-05, VR-03-01 |
| [PERF-01-01](tickets/PERF-01-01.md) | [T08](tasks/T08.md) | 공통 예산 상수·Python 전달 | CORE-01-04 |
| [PERF-01-02](tickets/PERF-01-02.md) | [T08](tasks/T08.md) | 서버 상한·UI 경고 연결 | CORE-01-04, PERF-01-01, CORE-02-04, ROOM-06-02, ED-03-01, AI-03-03 |
| [PERF-01-03](tickets/PERF-01-03.md) | [T08](tasks/T08.md) | 산출물 예산 검증기 | CORE-01-04, PERF-01-01 |
| [PERF-02-01](tickets/PERF-02-01.md) | [T08](tasks/T08.md) | 최대 씬·측정 수집 | ED-03-04, GEN-05-04, VR-02-05 |
| [PERF-02-02](tickets/PERF-02-02.md) | [T08](tasks/T08.md) | 내장 그래픽 편집 실측 | ED-03-04, GEN-05-04, VR-02-05, PERF-02-01 |
| [PERF-02-03](tickets/PERF-02-03.md) | [T08](tasks/T08.md) | Quest 2 VR 실측 | ED-03-04, GEN-05-04, VR-02-05, PERF-02-02 |
| [PERF-03-01](tickets/PERF-03-01.md) | [T08](tasks/T08.md) | 동시성·권한 회귀 묶음 | ACC-03-03, ACC-04-02, ACC-05-03, ED-04-04, GEN-04-03, VR-03-02, PERF-02-03 |
| [PERF-03-02](tickets/PERF-03-02.md) | [T08](tasks/T08.md) | 복원·생성 경합 회귀 묶음 | ACC-03-03, ACC-04-02, ACC-05-03, ED-04-04, GEN-04-03, VR-03-02, PERF-02-03, PERF-03-01 |
| [PERF-03-03](tickets/PERF-03-03.md) | [T08](tasks/T08.md) | 30명 수업 편집·AI·승인 흐름 | ACC-03-03, ACC-04-02, ACC-05-03, ED-04-04, GEN-04-03, VR-03-02, PERF-02-03, PERF-03-02 |
| [PERF-03-04](tickets/PERF-03-04.md) | [T08](tasks/T08.md) | 제출·재시작·2인 VR 흐름 | ACC-03-03, ACC-04-02, ACC-05-03, ED-04-04, GEN-04-03, VR-03-02, PERF-02-03, PERF-03-03 |
| [LIC-01-01](tickets/LIC-01-01.md) | [T09](tasks/T09.md) | 웹·빌드·테스트 의존물 확인 | 없음 |
| [LIC-01-02](tickets/LIC-01-02.md) | [T09](tasks/T09.md) | 서버·저장·큐 의존물 확인 | LIC-01-01 |
| [LIC-01-03](tickets/LIC-01-03.md) | [T09](tasks/T09.md) | 의존물 등록·lockfile 검토 기준 | LIC-01-02 |
| [LIC-02-01](tickets/LIC-02-01.md) | [T09](tasks/T09.md) | LLM·이미지 모델 후보 확인 | LIC-01-03 |
| [LIC-02-02](tickets/LIC-02-02.md) | [T09](tasks/T09.md) | GPU 자동 의존물 확인 | LIC-01-03, LIC-02-01 |
| [LIC-02-03](tickets/LIC-02-03.md) | [T09](tasks/T09.md) | XR 버전·조건 확인 | LIC-01-03, LIC-02-02 |
| [LIC-03-01](tickets/LIC-03-01.md) | [T09](tasks/T09.md) | 배경 제거 판매 경로 | LIC-02-03, GEN-04-03 |
| [LIC-03-02](tickets/LIC-03-02.md) | [T09](tasks/T09.md) | 텍스처 판매 경로 | LIC-02-03, GEN-04-03, LIC-03-01 |
| [LIC-03-03](tickets/LIC-03-03.md) | [T09](tasks/T09.md) | 판매 산출물 의존물 감사 | LIC-02-03, GEN-04-03, LIC-03-02 |

## 예상 버그 12건 추적

| 원본 번호 | 주 검증 티켓 |
|---|---|
| 1 강제 해제 뒤 늦은 드래그 | ROOM-03, ED-03 |
| 2 강사 수정 후 개인 undo | ROOM-04 |
| 3 복원 후 낡은 redo | ROOM-06 |
| 4 복원 중 생성 완료 | GEN-05, ROOM-06 |
| 5 복원 시 200개 상한 | PERF-01, ROOM-06 |
| 6 챗봇 원자 작업 중 경합 | ROOM-03, ROOM-04 |
| 7 일괄 작업 알림 폭주 | ROOM-06, ACC-05 |
| 8 매 프레임 이력 기록 | ED-02, ROOM-04 |
| 9 단절된 잠금 | ROOM-03 |
| 10 클라이언트 시계 순서 | ROOM-02, ROOM-04 |
| 11 복제 소유권 | CORE-02, ROOM-04 |
| 12 복원 후 낡은 선택 | ED-05 |

전체 재검증: PERF-03.

## 보류 범위

결제·좌석·크레딧 판매 모델, 편집 방의 VR 실시간 접속, VR 편집, 태블릿, 학생 채팅·평가·개인 구역은 이번 구현 티켓에 넣지 않는다. 서버 후보·모델·기기 미확인은 조사 티켓으로 해소하며 이미 확정한 것으로 취급하지 않는다.

## 플랜 완료 조건

- [x] 범위에 포함된 모든 티켓의 실제 검증 증거가 있다.
- [x] 각 태스크의 모듈화·통합 검증이 끝났다.
- [x] 범위 내 실제PC성능·GPU·소프트웨어VR 및 예상버그12건을 검증했다. 기기실측은 사용자제외다.
- [x] 남은 미확인·제외·판매 전 조건이 최상위 문서와 일치한다.

현재 상태(2026-10-14): **실행범위131/131 완료**, 전체137개 중6개 사용자제외 deferred. 198개단위/통합·브라우저27+실제생성복원1·Python7·모듈/타입/빌드 PASS. AMD내장그래픽200개모델60초 평균165.0fps. 30명6방 실제모델큐/승인/배치 및 제출재시작/2인감상 완료. [최종 통합 증거](../evidence/acceptance.md), [성능 원값과 조건](../evidence/performance.md), [회귀/코드리뷰 수정](../evidence/regression.md).

### 사용자 승인 범위 갱신

USER-2026-10-14-NO-HEADSET: 헤드셋이 없어 사용자가 이번 제작에서 실기기 검증을 제외했다. VR-03-01/02, PERF-02-03은 deferred(미검증)로 유지하며 이때 실행범위134개였으며 아래 추가제외 후 현재131개다. 이 세 티켓을 선행 조건으로 참조하는 통합 티켓은 소프트웨어 검증을 진행할 수 있다. PERF-03-04의 HTTPS 2인 감상은 브라우저/소켓으로 검증하고 헤드셋 조작은 제외한다.

## 최신 추가 범위 — 판매 경로 제외

USER-2026-10-14-NO-COMMERCIAL: 사용자가 판매용 라이선스 경로 LIC-03-01/02/03을 이번 제작에서 제외했다. 헤드셋 실기기 검증 3개와 합쳐 총6개 deferred, 실행 범위131개다. 이 범위131개는 모두 완료했다. 연구용 의존물 제한은 그대로 유지한다.
