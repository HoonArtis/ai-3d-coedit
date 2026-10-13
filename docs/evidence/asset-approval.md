# 생성물 승인·공유·배치 — 2026-10-13

- GEN-05-04: 후처리 완료 시 실제 방 저장소의 현재 generation과 요청 generation을 비교한다. 불일치면 stale_scene을 기록하고 승인 대기로만 남긴다. 일치/불일치 통합2조건 PASS. 어느 경우에도 워커나 승인 API가 씬을 직접 변경하지 않는다.
- ACC-03-01: 자기 수업 강사만 승인/거절. PostgreSQL 행 잠금으로 최초 결정을 저장하고 같은 결정 재시도는 같은 결과, 반대 결정은 DECISION_CONFLICT. 타 강사/학생 판정 거부. 승인·거절 양쪽과 중복/충돌 테스트 PASS. review_actor/reviewed_at 보존.
- ACC-03-02: 승인된 생성물만 같은 수업 라이브러리에 표시. 미승인 파일의 ID를 알아도 다른 학생/다른 강사는 403. 미승인 private preview는 담당 강사/제작 학생만. 공개 glb 경로는 승인 후에만 제공하며 원본4096은 제공하지 않는다. 세션 Bearer 확인, private/no-store. 승인 후에도 다른 수업은 접근 거부.
- ACC-03-03: 강사 승인함에서 실제 GLB/KTX2 WebGL 미리보기 → 승인 → 이미 접속 중인 학생 라이브러리 갱신 → 학생 더블클릭 place 공통 명령 → 서버 소유권·seq·잠금·저장 → 장면 렌더링. 승인만으로는 객체0개, 직접 place 후1개. Playwright 실제2브라우저 테스트 PASS. `approval-preview.png`, `approved-placement.png` 육안 확인.

## 검증 및 수정

- `tests/integration/asset-approval.test.ts`: 권한/교차 수업/양방향 결정/중복/충돌/직접 파일 접근 PASS. `generation-finishing.test.ts`: 큐 상태·명시적 프리셋·잘못된 job manifest·현재 세대0/1 PASS.
- `npx playwright test tests/e2e/approval.spec.ts tests/e2e/editor-collaboration.spec.ts tests/e2e/generation.spec.ts`: 4/4 PASS, 34.4초. 승인 테스트의 GLB는 경계 검증용 삼각형 fixture이며 실제 생성물 품질 평가는 texture-optimization.md의 별도 GPU 실측/렌더링이다.
- Playwright에서 Node JSON import attribute가 필요한 것을 오류로 확인, budgets.json import에 `with {type:'json'}` 추가. 타입/모듈/build 및 기존 테스트 재검증.
- 첫 미리보기 fixture는 단색 텍스처였고 glTF Transform prune이 재질 색으로 변환했다. 네트워크 trace와 원본 prune.ts의 solid-color 처리 확인 후, KTX 디코딩을 검증할 수 있도록 gradient fixture 및 manifest.texture 개수 assertion을 사용. 불필요한 타임아웃 연장이나 제품 코드 우회 없음. 테스트 finally의 브라우저 종료 오류가 DB 정리를 가리지 않도록 정리 경로도 수정했다.
- 생성 라이브러리 항목 증가 시 전체 페이지가 스크롤되어 헤더가 사라지는 스크린샷 문제 확인. 라이브러리 자체 세로 스크롤/자식 shrink 제한으로 수정, 같은4브라우저 테스트 재검증.
- 동일 문제 수정2회 연속 실패는 없었으며 각각 오류 메시지/trace/상류 소스를 근거로 수정했다.

## 모듈 경계

AssetService가 수업 접근·승인·파일 접근을 담당하고, 변환/저장은 기존 worker·ObjectStore 계약을 유지한다. 서버가 승인된 catalog만 RoomService에 주며 기존 place 판정·DurableRoom 저장 경로를 그대로 사용한다. 클라이언트는 library 이벤트와 보호된 GLB 요청만 소비한다. GeneratedModelProvider는 렌더러별 GLTF/KTX 캐시를 공유하고 마지막 참조 해제 시 geometry/material/texture를 정리한다. 타입/순환·경계 검사 PASS, production build PASS(기존 JS chunk 크기 경고는 후속 성능 범위).

연구 제한 provenance는 manifest에 유지한다. 판매 허용으로 판정하지 않았다. 기존 객체 retexture/강사 대시보드 썸네일·설정/VR은 후속 티켓이다.
