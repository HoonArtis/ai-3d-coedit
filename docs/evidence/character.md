# 캐릭터 제작·검증 — 2026-10-14

공개 계약 characterSource/characterDelivery → 인증된 upload → generation outbox → 격리 CPU Blender → character job → 승인 → 공용 library → skeleton별 인스턴스 → VR 아바타 경로를 구현했다.

- 실제 Blender5.1.2의 자체 리깅 FBX/GLB 변환: 두 형식 모두 desktop4800/avatar9600/정적VR2352 삼각형, 높이1.7m, 2관절/Idle 유지. 원값은 character-conversion.json.
- 파일 크기/형식, joint-weight/animation 손상, clip 없는 고정 자세: tests/integration/character-conversion.test.ts 3개 통과. 임의 외부 URI·morph는 거부한다.
- tests/tickets/character-instance.test.ts: 공유 원본과 다른 캐릭터를 움직이지 않는 독립 skeleton/mixer, 클립 없는 대체 자세 통과.
- tests/integration/generation-finishing.test.ts, asset-approval.test.ts: CPU 전용 outbox, 1회 차감, 본인 승인 캐릭터 선택, 학급 파일 권한, 캐릭터 retexture 거부 통과.
- tests/e2e/character.spec.ts: 실제 FBX 업로드/변환/승인/배치/정적VR굽기/아바타200응답/403기본대체 통과(17.2초). character-editor.png, character-avatar.png, character-avatar-fallback.png, character-animation.png 보관.
- 04:02 전체 단위·통합198개 통과, 모듈 경계/순환 의존 검사 통과. .superpowers/sdd/PLAN/final-unit.log 및 final-modules.log.

변환 실패 조사: GLB의 bone-display Icosphere는 공식 importer의 disable_bone_shape로 제외했다. 높이 손실은 분리된 normal/UV 정점의 감량 문제였으며 bind 위치와 관절 가중치가 같은 정점만 weld하고 loop UV를 보존해 해결했다. GEN-06-01의 실패 회차와 공식 근거를 유지한다. UI패널 겹침은 flex-shrink를 고쳤고 아바타 브라우저 테스트는 감상 방 연결 준비를 기다리도록 정정했다.

책임 검증: contracts는 데이터 검증만, 서버는 인증/차감/승인만, CPU adapter는 변환만 담당한다. UI는 권한을 판정하지 않고 승인된 파일만 요청하며 맵 배치는 기존 공통 명령을 쓴다. VR 아바타 포즈는 읽기 전용 presence 계약으로 분리했다. 원본 fixture와 캐시 model을 변형하지 않는다.

헤드셋 실기기 검증은 USER-2026-10-14-NO-HEADSET에 따라 제외했다. 포즈 수신/기본 대체는 브라우저와 실제 소켓으로 확인했으며 실기기 착용 결과를 주장하지 않는다.
