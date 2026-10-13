# 강사 대시보드 — 2026-10-13

- ACC-02-01: 자기 수업만 조회, 방 ID/seq에 결합된 실제 저장 snapshot으로 등각 배치 썸네일을 생성한다. 물체 경계 상자로 배치를 나타내는 SVG 개요이며 원본 메시의 상세 렌더링을 흉내 내지 않는다. 발급 학생 수와 방별 승인 대기 수 표시. 5초 갱신과 요청 순번으로 오래된 응답 덮어쓰기를 방지한다.
- 잘못된 roomId snapshot은 DB CHECK에서 거부됨을 테스트했다. 감사 로그를 제거한 격리 시험 schema에서는 `CORRUPT_ROOM_LOG`가 썸네일 읽기 실패로 표시되며 다른 방 데이터는 영향받지 않는다. 실제 seq0→1 배치 변경과 다른 방의 빈 상태가 섞이지 않음을 확인.
- ACC-02-02: 학생5개 Colyseus 연결 유지 중 대시보드에서 강사로 입장 성공. 학생의 동일 room-session API 결과는 student 권한이며 여섯 번째 연결은 ROOM_FULL. 실제 브라우저가 teacher identity로 접속하고 공통 place 후 대시보드로 돌아와 저장된 썸네일 seq1 확인.
- ACC-02-03: 강사가 수업별 생성 한도0~1000 정수 저장. 0이면 새 생성 중지, 기존 사용량 보존. 학생/타 강사/음수/소수/NaN/초과값 거부. GenerationRepository가 변경 값을 읽어 0회 거절→1회 성공→다시0회에도 used1을 유지하는 실제 DB 검증.

## 검증

`dashboard.test.ts`, `accounts.test.ts`, `asset-approval.test.ts` 정상/실패 PASS. `playwright test dashboard.spec.ts accounts.spec.ts approval.spec.ts` 4/4 PASS(25.1초). 썸네일 처음 투영에서 앞면 방향이 뒤집힌 것을 스크린샷으로 발견해 수직 투영 부호를 수정, 같은 dashboard 브라우저 시나리오 재실행1 PASS(7.0초), 수정 스크린샷 `dashboard-live-state.png` 육안 확인. 타입/모듈 경계 검사 PASS.

실패 주입의 첫 roomId 변경은 예상보다 더 앞선 DB 제약에서 거부됐다. 제약을 약화하지 않고 해당 거부를 assertion으로 고정했으며, 격리 schema의 로그 손상으로 읽기 실패 UI 경로를 검증했다. 동일 문제 수정2회 연속 실패가 없어 사례 조사 분기는 미발동이다.

권한/한도 변경은 AccountService 공개 메서드로 통합했고 승인 서비스도 같은 강사-수업 판정을 사용한다. DashboardService는 저장 snapshot/승인 수만 조합하며, 화면 투영은 UI 모듈이다. 씬 변경은 기존 RoomService/DurableRoom을 통과한다. 서버 모듈이 UI나 GPU 변환을 가져오지 않는다.
