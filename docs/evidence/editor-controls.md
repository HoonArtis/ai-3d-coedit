# 에디터 상세 조작 검증

2026-10-13. 실제 Chromium/R3F/Colyseus, E2E서버4174/2568.

| 티켓 | 검증 파일·결과 |
|---|---|
| ED-01-02 | ed-01-02.spec.ts 휠줌/우클릭궤도/중클릭pan 화면변화, 패널스크롤 무영향. editor-gizmo.spec.ts 드래그 중 카메라거리 유지 |
| ED-01-03 | camera.test.ts focus/orbit/zoom·없는대상/NaN거부·씬불변. ed-01-02.spec.ts 버튼줌/궤도/선택없음안내. CameraRig는 transport를 호출하지 않음 |
| ED-02-01 | editor-manipulation.spec.ts 실제HTML드롭1개, 잘못된payload0개. 서버 snapshot으로만 확정하여 유령로컬객체 없음 |
| ED-02-02 | editor-gizmo.spec.ts 실제Y핸들 이동/undo, manipulation의 Esc중단·undo는배치취소이므로드래그이력0개 |
| ED-02-03 | manipulation 실제E회전/undo, properties90도입력후빈값재입력은90도유지. 회전값표시rad→degree복구결함 수정 |
| ED-02-04 | manipulation 실제R크기변경/undo, 음수스케일드래그거부및1복원. properties0입력거부 |
| ED-02-05 | properties 이름·회전빈값/크기0/위치입력. interaction-state의 TransformEditQueue가 빠른축입력을직렬병합하고거부시확정값사용 |
| ED-02-06 | actions복제·undo·redo, properties이름변경/빈이름거부, collaboration의타인선택거부와삭제5창반영 |
| ED-02-07 | properties회전된raisedcube스냅Y0.5서버결과. placement의groundPosition(null) NO_GROUND·회전AABB바닥검증 |

바닥은 현재 고정 y=0 평면이다. 받침면 없는 입력은 순수 배치 계약에서 거부하며 화면에 존재하지 않는 지형 모드를 시험했다고 쓰지 않는다. 기즈모 취소/거부 복원은 공통 restoreTransform/선택lease 처리로 세 모드에 적용된다.

기존 결함과 회귀: 그룹ref 오연결, 만료lease, 선택경쟁, 거부기즈모복원은 첫리뷰이후회귀테스트로고정. 빈회전입력후라디안이도처럼표시되는결함과숫자입력경쟁은 추가단위/브라우저 RED→GREEN. 타입/modules PASS. 전체브라우저16개PASS, 추가rename와카메라무영향/실제LLM3개PASS(21:52).

모듈 책임: 카메라순수계산 camera.ts, local scene 표시 Viewport/AssetModel, 입력표시 TransformPanel, 서버명령 연결 useEditor/RoomTransport, 선택/입력경쟁 interaction-state. 권한·잠금·배치좌표를 UI에 복제하지 않는다. 명령확정은 공통 API를 거친다.

계획상 티켓별 test filename은 위 공통 fixture 파일로 통합한 조정이다. 존재하지 않는 파일을 실행했다고 기록하지 않는다.
