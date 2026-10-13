# 첫 실행 가능한 구현 검증 — 2026-10-13

작업 브랜치: feat/implementation. 위치: .worktrees/implementation.
이 문서는 전체 137개 티켓 완료 보고가 아니다.

## 실제 구현
- contracts: 29개 명령 스키마, 인증 주체 대조, 씬/이벤트/잠금/예산 계약.
- domain: 배치·변형·복제·삭제·이름·조회, 소유권/잠금/200개 상한, 원자 적용.
- server: Colyseus adapter, 학생/감상자 5명 정원과 강사 예외, 요청 중복 방지,
  seq/방송, 30초 잠금과 강제 해제, 요청 단위 개인 undo/redo.
- web: R3F 편집 화면, 기본 에셋 6종, 기즈모·숫자 입력·복제·삭제·선택 목록,
  개인 카메라, 서버 명령 transport. AI 패널은 준비 중 상태다.
- 로컬 체험 계정과 서버 메모리는 개발 검증용이다. 수업 계정/영구 저장 구현으로 간주하지 않는다.

## 실행 결과
- npm test: 15개 파일, 79개 테스트 통과.
- npm run test:e2e: Chromium 7개 통과. 화면/빈 검색/창 크기/휠 줌/배치/
  숫자 입력/복제/undo/redo/5개 독립 브라우저/타인 수정 거부/Y 기즈모 드래그.
- npm run build: TypeScript 및 Vite 성공. JS 1.46 MB(압축 408 KB), 번들 경고 남음.
- npm run check:modules: 공개 경계와 순환 의존 PASS.
- 모듈 책임: UI 임시 표현은 editor, 잠금·이력은 rooms, 순수 판정은 domain,
  공개 데이터 검증은 contracts. 서버 서비스는 injected clock으로 독립 검증한다.
- 실제 화면: [editor-preview.png](editor-preview.png).
- 회전/크기 기즈모의 실제 드래그 경계, 모든 카메라 조작, 재접속 UI 복구,
  장시간 경합과 저사양 성능은 추가 검증 필요. 관련 티켓을 done으로 처리하지 않았다.

## 실패·수정·조사 기록
| 문제 | 원인/근거 | 수정 | 재검증 |
|---|---|---|---|
| 연속 undo/redo 체인 | 내부 expected seq 갱신으로 이전 항목 연결 끊김 | 값과 마지막 변경자 기준 검증 | room-service 연속 체인 통과 |
| 브라우저 테스트 종료 뒤 ROOM_FULL | context.close가 페이지 unload를 생략, 재접속 좌석 15초 유지 | pagehide 정리만 추가한 1차 수정 실패. Playwright 공식 page.close 문서 확인 후 about:blank 정상 이탈 fixture 추가 | 동일 2개 테스트 통과, 전체 7개 통과 |
| 만료 lease가 heartbeat로 부활 | expire sweep 이전 갱신 | heartbeat 시작 시 expire | 30001ms 재현 RED → GREEN |
| 연결 종료 뒤 원격 preview 잔류 | locks 이벤트에서 preview 미정리 | 토큰이 같은 lease만 보존 | editor-review 회귀 통과 |
| 빠른 선택 전환 뒤 잠금 누수 | 비동기 선택 응답 경합 | SelectionQueue 직렬화·낡은 획득 반환 | 지연 응답/취소 회귀 통과 |
| 거부된 기즈모 변형 잔류 | Three group 직접 변경 후 같은 React props가 복원하지 않음 | 확정/거부 시 authoritative transform 복원, 취소 시 선택 해제 | Group 복원 회귀 및 기즈모 E2E 통과 |
| 기즈모 원점이 에셋과 불일치 | drei wrapper group에 붙고 child group 값을 전송 | 실제 에셋 group을 object prop에 명시 | Y 드래그 서버 반영과 undo 통과 |

공식 조사: https://playwright.dev/docs/api/class-page#page-close .
drei 적용 근거: 설치된 node_modules/@react-three/drei/core/TransformControls.js의 object/children attach 분기.
별도 코드 리뷰: Important 4개, Critical 없음. 4개 모두 위 수정/회귀에 반영.
같은 증상의 수정·재검증 2회 연속 실패는 발생하지 않았다. 원래 실패와 수정 실패를 구분한다.
THREE.Clock upstream deprecation 경고와 큰 번들 경고는 숨기지 않았으며 성능 완료 근거로 사용하지 않는다.

## 이어서 할 일
1. ROOM-01 서버 후보 비교/선정 근거 확정, ED-01/02 남은 조작별 경계 검증.
2. 각 ROOM-02/03/04 완료 조건을 별도 증거와 대조(현 단계는 통합 선행 실험).
3. PostgreSQL 명령/스냅샷 저장과 재시작 복구.
4. 계정/방 코드, 결정적 배치, 로컬 LLM·큐·GPU, 강사 승인, VR 순서로 계속.
