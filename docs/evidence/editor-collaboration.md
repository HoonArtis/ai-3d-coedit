# 협업 UI 검증 — 2026-10-13

ED-03-01~04. `npx playwright test tests/e2e/editor-collaboration.spec.ts tests/e2e/teacher-intervention.spec.ts tests/e2e/editor-actions.spec.ts` 실제 Chromium 3개 PASS(24.1초).

- 01: 별도 브라우저 컨텍스트 5개의 같은 방 생성·변형·삭제 반영. 예전 고정4173 주소를 fixture baseURL4174로 고친 후 새 서버로 검증. snapshot은 서버seq만 사용하며 이전seq 거부는 interaction-state 단위 검증과 함께 확인.
- 02: 자기 선택 lock, 해제 unlock, 남의 객체 선택 거부 시 속성 비활성/선택 없음. `actor-color.ts`로 학생별 동일 색을 모든 관찰자에서 사용, actorColor 단위 RED→GREEN. 이름표/시점 아이콘 추가 없음. 렌더 테두리만 표시.
- 03: 실제 기즈모 drag중 강사의 force_unlock, 늦은 mouseup에도 위치0/seq1유지. 잠금token/선택 변화는 layout effect에서 원상복원.
- 04: UI undo/redo복제 정상, 강사 수정후 학생 undo거부/강사위치 유지. 버튼/단축키 모두 동일명령 send를 사용.

모듈화: 표시/색은 프론트, selection queue는 비동기 lock조정, 권한/이력은 서버 공개 명령 경로. 색 함수는 도메인 권한을 복제하지 않는다. `npm run check:modules`, typecheck PASS. 같은 문제 수정2회 실패 없음. 기존 상호작용 리뷰 수정은 editor-controls.md 및 SDD 장부 참조.
