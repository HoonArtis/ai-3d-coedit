# VR 감상 클라이언트 구현 검증 — 2026-10-14

Quest3를 우선 실험 대상으로 준비했다. 실제 헤드셋은 아직 연결되지 않았으며 아래는 PC 자동 검사와 브라우저/소켓 검증이다. 실기기 FPS/컨트롤러 조작/HTTPS 인증서 수용은 VR-03 및 PERF-02에서 별도 수행한다.

- @react-three/xr6.6.31: 설치된 store.d.ts/teleport.js와 공식 https://pmndrs.github.io/xr/docs/getting-started/introduction 및 /docs/tutorials/teleport 확인. offerSession/enterGrantedSession/emulate 모두 false. 버튼 핸들러에서 직접 enterVR을 호출하며 네트워크 좌석 확보는 미리 끝낸다.
- `tests/e2e/vr.spec.ts`2건: 실제 계정/제출/CPU변환/GLB/Basis미리보기. 미지원 안내·입장비활성, requestSession 호출0. 지원 응답 fixture에서 클릭 후 immersive-vr와 userActivation=true를1회 기록, 권한거부 안내 후 자동재요청0. insecure context fixture에서 HTTPS안내·요청0. 이 fixture는 실제 세션 성공을 흉내내지 않는다.
- readonly: UI 편집기능 없음; 실제 감상 Colyseus 서버는 command를 READ_ONLY로 거부. 인증없음401/불완전산출물409 검증. GLB로딩실패는 안내하고 입장준비false 유지.
- 텔레포트: 공용 placement/navigation의 반경.3m/높이1.8m 몸체와100m바닥, 선분-AABB로 목적지·경로충돌 검사. 범위밖/높이/NaN/벽관통/몸체겹침/완전막힌spawn 거부 테스트. XRteleport가 제공하는 origin보정과 실제 e.point를 구분해 이동경로 계산. thumbstick연속이동/비행 없음. 실제 손잡이 입력 검증은 미완료.
- 정원: 서버 인스턴스의 공용 RoomCapacity를 편집/감상방에 주입, 논리room당학생+VR5석. 편집강사 정원외. 실제PG/Redis/Colyseus통합에서4편집+1감상,추가입장거부,2감상전환,교사정원외,재접속예약 검증. 다중서버배포는 아직 지원범위아님.
- 포즈: strict공통schema,인증actor서버부여,10Hz출력,좌표범위/단위quaternion/sequence확인. 위조actor패킷거부. 입력프레임은head/손마다실제추적존재확인,손소실null. drop/pose-stop즉시제거,1초미갱신제거,재접속15초좌석유지.
- 기본아바타: 머리구와시선표시·손box,이름표없음. 실제2클라이언트 포즈전달 및 drop삭제/재접속 테스트. `vr-avatar.png` PC브라우저에서머리+왼손 표시후pose-stop시0명확인. 리깅캐릭터는 GEN-06후속.

검증: 전체54파일182테스트 PASS (`.superpowers/sdd/PLAN/vr-session-tests.log`), VR브라우저2건PASS (`vr-session-browser.log`), 기반전체브라우저25건PASS (`vr-all-browser.log`), 기존방재접속과새VR통합5건PASS. type/module/buildPASS (`vr-session-build.log`), 청크크기경고는 남아 있다.

모듈화: placement는순수충돌·spawn,contracts는공통pose/환경계약,server/capacity·viewing-room은권한/정원/전달,web/pose는XR입력변환,Presence는전송/아바타,Lobby는선택/진입. GLB로드는기존공용provider를path기반으로 확장해기존승인/에디터회귀도통과했다. 새 명령변경경로없음.

의도한RED→구현→동일검증PASS. 동일문제2회수정실패없음. 미검증실기기조건을완료로치환하지 않는다.
