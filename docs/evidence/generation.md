# 생성 이미지·형상 검증 — 2026-10-13

GEN-02-01~04, GEN-03-01~03의 증거다. 형상 이후 텍스처·감량·승인·배치는 후속 티켓이다.

## 실제 실행

- 직접 GPU: SDXL 768²/25steps 21.006초 → RMBG 2.7초 → TripoSG 30steps 26.192초, 52,816삼각형. 입력/출력은 `.cache/smoke`, 로그는 `.superpowers/sdd/PLAN/gpu-*-smoke.log`.
- 실제 PostgreSQL/Redis/별도 GPU 워커: `npx tsx tools/smoke-generation.ts` PASS. 이미지 21.280초, 확인→형상까지 전체 50.690초. 중복 확인은 동일 작업, 사용량 1회. 파일 GLB magic과 실제 BullMQ 완료를 함께 검사했다. [원시 결과](generation-gpu-queue.json).
- 최초 41.535초 결과는 테스트 fixture가 공유 DB 작업을 소비한 오염 때문에 폐기했다. `image-confirmation.test.ts`를 고유 PostgreSQL schema로 분리 후 위 실측을 새로 수행했다.
- `npx tsx tools/measure-gpu.ts`: 실제 CUDA OOM(장치 메모리 128배 요청) 2회 종료코드75 후 같은 BullMQ 워커의 다음 정상 TripoSG 성공. 29.615초, PyTorch peak allocated 4,898.3MiB / reserved 5,772MiB. 이 값은 전체 장치 사용량이 아니다. [원시 결과](gpu-memory-recovery.json).
- 첫 OOM 실험의 2배 요청은 Windows 공유 메모리로 성공해 의도한 오류가 발생하지 않았다. 실패 사유 확인 후 물리/공유 메모리를 넘는 128배 요청으로 변경, 실제 OutOfMemoryError 분류와 복구를 확인했다.

## 계약·정상·경계

- GEN-02-01: 글은 image 큐, PNG/JPEG/WebP는 실제 디코딩 후 확인 대기. 10MiB/8,388,608pixel/최소16px, 애니메이션·SVG·손상 거부. 빈/손상 입력은 차감과 3D 작업 전에 거부.
- GEN-02-02: NFKC/제로폭 문자 정리 후 수업용 텍스트 차단 규칙. 차단 요청은 큐에 넣지 않고 이유 표시. 규칙 기반 텍스트 필터이며 포괄적인 이미지 내용 판별 모델은 아니다. 수업 공유는 별도 강사 승인 대상이다.
- GEN-02-03: 수업 행 잠금으로 마지막 1회 원자 예약. 학생 requestId 동일 입력은 중복 차감 없음, 다른 입력은 충돌. 이미지/형상 실패는 한 번만 반환. 정상 재생성은 추가 1회, UI에 정책 표시.
- GEN-02-04: 최신 버전만 확인, 확인 전 3D없음. 이전 버전·다른 학생 확인 거부. 중복 확인 동일 shape작업. 확인된 버전 재생성 거부. durable outbox 재시작 복구.
- GEN-03-01: 제공 alpha는 모델 생략, 완전 빈 전경/없는 모델은 산출물 없음. 실제 RMBG local weights 경로 성공, 연구 전용 출처 기록.
- GEN-03-02: 실제 TripoSG 메시+metadata JSON. 빈 메시/NaN은 GLB를 쓰지 않음. 비정상 subprocess는 성공 산출물로 반환하지 않음.
- GEN-03-03: 위 실제 GPU 시간/환경/메모리/OOM후다음작업 증거. RTX5060Ti16GB, Python3.11, [실행 환경](gpu-environment.json). DISO 미설치, 공식 hierarchical decoder. `workers/gpu/prepare_vendor.py`로 MIT 소스/optional import 패치 재현.

## 검증 명령

- `npm test`: 이 단계 전체 134개 PASS, 색 함수 추가 개별1 PASS.
- `npx vitest run tests/integration/generation.test.ts tests/integration/image-confirmation.test.ts`: 실제 PG/Redis 6개 PASS. 모델이 없는 통합 fixture는 위 실제 모델 실측과 구분.
- `.venv/Scripts/python.exe -m pytest workers/gpu/tests/test_adapters.py -q`: 4개 PASS.
- `npx playwright test tests/e2e/generation.spec.ts`: 1개 PASS. 차단 입력, 손상 업로드, 실제 PNG 미리보기, 확인 대기, 사용량, 새로고침 복구, 씬 무변경. [화면](generation-confirmation.png).
- 첫 UI 실행에서 X-Request-ID CORS 사전 요청 거부. 브라우저 trace로 확인하고 요청 ID를 upload URL 매개변수로 이동. 재검증 PASS, 추가 헤더 허용 확대 없음.
- `npm run typecheck`, `npm run check:modules` PASS(공용 contracts/artifacts 경계 변경 후).

## 모듈화

UI는 계약과 HTTP/공통명령만 소비한다. 서버는 session→권한/횟수/버전/저장, jobs는 큐, artifacts는 불변 파일, GPU는 Python adapter의 책임이다. 생성 시작은 공통명령의 generate로 접수하며 다른 씬 변경과 섞인 요청은 전체 거부한다. 이미지 확인/업로드/상태는 씬을 바꾸지 않는다. 추후 승인된 산출물 배치도 같은 place 경로를 사용한다.
Python adapter는 UI/서버/DB를 import하지 않으며 subprocess JSON+파일 계약을 쓴다. TypeScript 모듈 검사는 Python까지 검사한다는 뜻이 아니다. Python의 import 방향은 파일과 pytest로 별도 확인했다.

동일 문제의 수정·재검증 2회 연속 실패는 없었다. 의도적 RED는 구현 부재 import 오류, GPU 오류 실험은 별도 실패 조건 증거다.
