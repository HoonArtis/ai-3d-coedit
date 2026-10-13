# 성능 검증 — 2026-10-14

측정 도구: tools/windows-gpus.py로 DXGI LUID를 실제 조회하고 tools/measure-editor.ts가 해당 AMD 어댑터를 Chromium에 지정한다. tests/performance/client.tsx는 실제 제작 Viewport와 모델 loader를 사용하며, 서버 데이터 대신 재현 가능한 읽기 전용 200개 fixture를 전달한다. 200개의 별도 URL을 각각 decode하여 같은 텍스처를 한 장만 공유하는 최적화로 메모리를 축소하지 않았다.

최종 조건과 원값은 editor-integrated-gpu.json, 화면은 editor-integrated-gpu.png다. 헤드리스 결과는 최종 판정에서 제외했다. Ryzen9 9900X/12코어24스레드, AMD driver32.0.11024.2, AMD Radeon Graphics 2GB 전용/약49GB 공유 가능, D3D11 실제 renderer 문자열, Chromium156, 1280×720/DPR1, 모든200모델 로딩 후10초 워밍업 및60초 측정. 창을 표시한 브라우저에서 평균165.0fps, p95 6.3ms, p99 6.4ms, 최대7.2ms로 30fps 목표 통과. 200개×4842삼각형 fixture, 최종 프레임968404삼각형/202draw, 202geometry/203texture, JS heap 약487MB. heap은 VRAM이 아니며 전체 GPU 메모리량을 측정했다고 해석하지 않는다. 이 PC의 결과이고 모든 저사양 기기의 보장은 아니다.

실패 조사: LUID 강제 headless에서 Page.captureScreenshot2회 실패, 공식 Three.js https://threejs.org/manual/pages/tips.html 의 동기 render/toDataURL 대안도 검은 결과였다. 공식 WebGLRenderer renderTarget/readPixels와 최소 red-clear 실험으로 어댑터의 기본 동작을 분리 확인했다. 창을 표시한 Chromium에서는 실제200모델과 nonzero readback이 확인되어 동일 렌더 설정으로60초 재측정했다. 예비 headless60fps는 채택하지 않았다. docs/work/tickets/PERF-02-02.md와 .superpowers/sdd/PLAN/perf-* 로그에 이력을 보존한다.

측정 수집기 tests/tickets/perf-02-01.test.ts는 로딩/워밍업 제외, 재로딩 시 재시작, 미완료 결과 거부, 분포 계산을 검증했다. 전체198개 및 module 검사 통과. 진단 코드는 tests/performance에 있고 제작 Viewport에는 선택적 진단 child만 추가했다. 제품의 씬 명령/권한 경로는 바꾸지 않았다.

재현: `$env:PERF_HEADED='1'; npx tsx tools/measure-editor.ts`. .data/objects의 실제 textured-artifact.json 대상 파일이 필요하다. PERF_CAPTURE_ONLY는2초 진단용이며 최종 판정에 사용하지 않는다. Quest2/3 실기기 측정은 사용자 제외 범위다.

최종 측정은 RGB nonzero readback까지 gate로 검사한 perf-igpu-final.log와 일치한다. 이전151.6fps 측정도 통과했지만 원값·현재JSON은 마지막165.0fps 조건을 가리킨다.
