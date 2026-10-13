# VR 제출과 변환 검증 — 2026-10-14

불변 제출 → PostgreSQL outbox → CPU BullMQ → LOD → 아틀라스/정적 병합 → KTX2 → 마지막 manifest 발행 → 인증 API 순서로 구현했다. Python 후보 대신 기존 TypeScript glTF Transform/meshoptimizer/KTX CPU 모듈을 재사용했다.

- `tests/integration/vr-registration.test.ts`: 동시 제출/등록 5회 각각 한 건, 이후 live 편집과 무관한 원본 seq, 재시작 후 동일 작업, 불완전 결과는 failed/manifest null. 실제 PostgreSQL/Redis/HTTP/CPU 변환으로 완료 전409, 완료 후GLB200, 무인증401.
- `tests/integration/vr-bake.test.ts`: 200개 객체 전부 보존, 원본 바이트 불변, 1024 KTX2와 11밉, 다른 방 identity 거절, 빈 방은 빈 장면으로 유지.
- `tests/tickets/vr-parts.test.ts`, `vr-atlas.test.ts`: 객체 TRS/법선/원본 버퍼 보존, 노드 변환, unsupported 재질 거부, 200개 기본 메시 병합, 선형 색상 곱과 PBR 그룹 보존.
- `npx tsx tools/smoke-vr.ts`: 이전 실제 MV-Adapter 고래 생성물100개 + 기본 나무100개, 1.637초, 13,612,768바이트, 267,000삼각형. 고래2450/나무220삼각형. `vr-bake.json`은 identity/provenance 포함.
- `npx tsx tools/render-vr.ts`: 실제 Chromium GLTFLoader/Basis 렌더러 두 시점에서 각각2 draw calls/267,000삼각형. `vr-render.json`, `vr-bake-render.png` 실제 확인. 기존 `textured-comparison.png`와 비교해 고래/벤치 형상·색상 유지, 나무/배치 보존 확인.
- `npm test`: 51파일177테스트 PASS (`.superpowers/sdd/PLAN/vr-tests.log`). typecheck/module경계 PASS.

블렌딩 투명도, normal/occlusion/MR/emissive 별도 맵, material extension, COLOR_0, 반복 UV는 현재 손실 없이 병합할 수 없으므로 명시적 실패로 처리한다. 현재 생성/프리셋 경로는 해당 재질을 쓰지 않는다. 아틀라스 슬롯248px로 축소되므로 텍스처 세부 품질의 감소는 있다. 지원 범위를 몰래 확대해 완료로 판정하지 않는다.

수정 기록: 의도한 RED 이후 테스트 통과. TypedArray의 ArrayBufferLike/ArrayBuffer 타입 불일치1회는 실제 생성 버퍼에 맞는 함수 인자 타입으로 좁혀 typecheck 재통과. 같은 문제2회 실패 없음. 기본 flatShading non-indexed geometry 경고는 이미 non-indexed면 clone하도록 정정했다.

모듈화: contracts는 스키마/예산, geometry는 에디터와 워커 공통 기본 메시, workers/vr는 변환/검증, server/vr는 계정 권한·outbox·완료 발행을 담당한다. 편집 씬을 직접 변경하지 않는다. 저장소 공개 ObjectStore/JobQueues API 사용, 의존/순환검사 PASS.

Quest3 사용자 실험 예정. 위 수치는 PC 브라우저 결과다. Quest2 72fps·Quest3 실측·PICO 지원은 아직 미검증이며 별도 티켓에서 수행한다. VR 감상 UI와 세션/아바타 연결은 후속 구현 중이다.

UI 통합 후: 실제 제출→worker완료→읽기전용 GLB 미리보기→미지원 VR버튼 차단 브라우저PASS. 전체 브라우저25/25 PASS (`.superpowers/sdd/PLAN/vr-all-browser.log`), 빌드PASS (`vr-build.log`, 청크크기경고 존재). `vr-lobby.png` 실제 확인. VR세션/텔레포트/아바타의 실기기 검증과는 구분한다.
