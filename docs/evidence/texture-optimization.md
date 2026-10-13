# 텍스처·감량·예산 검증 — 2026-10-13

## 실제 실행

- GEN-04-01: SDXL/MV-Adapter 6방향 512 이미지, 30 steps, seed42 → 4096 UV GLB. RTX5060Ti16GB, 연구용 Linux container. 전체 88.294초, 최고 할당10001.8MiB/예약11584MiB. `mvadapter-gpu.json`, `workers/gpu/run_texture.py`, `.superpowers/sdd/PLAN/mvadapter-final.log`에 근거. 호스트 Windows와 다른 Python 의존성은 Dockerfile에 고정했다.
- GEN-05-01: 실제 TripoSG 원본52816 → desktop4898 → VR2450 삼각형. `mesh-optimization.json`, `mesh-comparison.png` 두 방향에서 형상 보존 확인. 빈/손상/퇴화 메시 거부 테스트. 감량 전에 skin/animation/morph 입력을 별도 캐릭터 파이프라인 대상으로 거부한다.
- GEN-05-02: 실제 텍스처 출력4842삼각형, 4096 원본1068980바이트를 별도 immutable object로 보관. 배포337756바이트, 1024 KTX2/BasisLZ, 전체11개 mip. `textured-artifact.json`의 originalKey와 desktop.key 분리. 배포 GLB에 원본4096 텍스처 없음. `tools/publish-smoke.ts`로 재실행한다.
- 실제 Chromium WebGL + Three GLTFLoader/KTX2Loader 디코딩 성공. `tools/render-artifact.ts`, `textured-comparison.png` 압축 전후 육안 확인. 고래·벤치 색과 윤곽은 유지되며 원본에도 있는 등받이의 투영 얼룩은 그대로 보인다. 생성 품질을 완벽하다고 판정하지 않으며 강사 승인 단계에서 채택 여부를 결정해야 한다.
- PERF-01-03: 공통 `checkArtifactBudgets`는 200개/5000/2500/100만/50만/150 draw call/1024/아바타1만을 구분해 보고한다. NaN·음수·누락 측정값을 거부. 실제 GLB 입구 `verifyArtifact`가 바이트로 삼각형·텍스처를 다시 측정한다. 입력 manifest만 믿고 실제 파일을 승인하지 않는다.

## 검증·수정 기록

1. 의존 import 실패2회(imageio 누락, pymeshlab Percentage 제거) 후 추측 중단. 상류 requirements/import 그래프와 [PercentageValue 공식 문서](https://pymeshlab.readthedocs.io/en/latest/classes/percentage_value.html) 대조. 누락 의존성 고정 및 PercentageValue alias로 복구. 재현 패치는 `prepare_vendor.py --texture`.
2. CPU offload가 참조용 딕셔너리를 복사하여 attention key가 사라짐. Accelerate1.6 최소 재현으로 원본/복사본 변이 차이를 확인. [공식 hooks](https://github.com/huggingface/accelerate/blob/main/src/accelerate/hooks.py), [관련 이슈1394](https://github.com/huggingface/accelerate/issues/1394) 확인 후 ReferenceCache 객체로 유지. 회귀 테스트 통과, 실제 30steps 완료.
3. UV 실행 exit139. UV만 따로 실행하면 Non-manifold mesh 오류. [Open3D0.19 문서](https://www.open3d.org/docs/release/python_api/open3d.t.geometry.TriangleMesh.html)와 [상류 MV 이슈65](https://github.com/huanngzh/MV-Adapter/issues/65)를 확인했다. 공식 preprocess_mesh=True 적용 후 UV 통과. 해당 옵션은 작은 분리 성분 제거·평활화를 포함하므로 처리 전후 원본을 별도로 보존한다.
4. 다음 실패는 CV-CUDA inpaint의 `no kernel image`이며 faulthandler로 정확한 호출을 확인했다. [CV-CUDA 설치/아키텍처 표](https://github.com/CVCUDA/CV-CUDA)와 [OpenCV inpaint 계약](https://docs.opencv.org/4.5.2/d7/d8b/group__photo__inpaint.html)을 확인. 이 런타임에서는 OpenCV CPU Telea 경계 채우기를 명시적으로 사용한다. mask/shape/dtype/device/관측 픽셀 보존 테스트 통과. 실제 투영 및 전체 재실행 성공. 재질 preset으로 몰래 대체하지 않는다.
5. toktx의 잘못된 encode 이름은 오류 없이 비압축 출력을 만들었다. 파일 크기 검사로 발견, 공식 portable binary `--help` 확인하여 `etc1s`로 수정. 헤더 vkFormat0, BasisLZ scheme1, mip 범위 검사를 추가. 잘못된 인코딩/손상 입력은 예외이며 원본을 배포 대신 반환하지 않는다.

## 회귀 및 모듈화

- `npm test`: 143/143 PASS(산출물 publish 추가 전 전체). publish 실패/재시도/동일 artifactId 검증 추가1 PASS. `npm run typecheck`, `npm run check:modules` PASS.
- `tests/integration/optimization.test.ts`, `texture-compression.test.ts`, `artifact-budget.test.ts`, `artifact-storage.test.ts`, `tests/contracts/artifact-budgets.test.ts`.
- Python ReferenceCache1/UV padding2/adapter4 테스트. 모델 성공은 mock이 아닌 위 실측으로 별도 판정.
- 예산/manifest 계약은 contracts, 파일 접근은 artifacts, GLB 변환은 workers/optimization, 연구 추론은 workers/gpu. UI/DB/씬 권한을 이 모듈에 추가하지 않았다. 씬 변경 없음. GLB 소비자가 manifest 공개 계약을 사용하며 상한 값은 BUDGETS 한 곳에서 읽는다.
- GPU/UV 실패는 프로세스 실패로 전달된다. 이 단계는 직접 추론 검증이며 큐에서 텍스처→승인→배치 연결 완료를 뜻하지 않는다. 해당 후속 티켓은 계속 진행한다.

## 연구 의존성

nvdiffrast·RMBG 연구 제한, pymeshlab GPL3, SDXL 조건을 유지한다. `docs/licenses.md`와 원문 사본 참조. 실기기 FPS를 측정한 결과가 아니며 Quest3/Quest2/PICO 성능을 이 데스크톱 결과로 대신하지 않는다.


## 큐와 산출물 등록 추가 검증

GEN-05-03: 실제 별도 GPU/CPU worker + PostgreSQL outbox + Redis에서 `texture_queued → optimize_queued → pending_approval` 101.945초. 기존 실제 이미지/형상을 입력으로 사용했으므로 이 시간은 이미지/형상 생성 시간을 포함하지 않는다. 한도1회만 사용. `finishing-gpu-queue.json`, `tools/smoke-finishing.ts` 참조. 모든 객체 저장/검증 후에만 최종 manifest hash를 DB에 등록한다. 원본/desktop/manifest 일부 저장 실패 시 완료 ID를 반환하지 않으며 재시도는 같은 content hash로 복구한다. 다른 job/version/generation manifest는 등록 거부 및 최종 실패 환급. 저장소 실패/재시도/중복 검증, 실제 큐 실측으로 완료 판정했다.

추가 검증: 전체146/146 테스트, typecheck/modulecheck PASS. 브라우저 generation2/2 PASS: 파일 검증/명시적 이미지 확인, 텍스처 실패 표시 유지/명시적 preset 선택/추가차감 없음/자동배치 없음. Python7/7 PASS. GPU worker에 bounded offline Docker texture 실행을 추가했으며 종료/실패 시 해당 이름의 컨테이너만 제거한다. CPU 변환은 별도 worker, manifest/한도는 contracts, 권한/상태 저장은 서버 모듈이다. retexture(기존 객체 변경) 및 강사 승인·라이브러리 배치는 아직 후속 범위다.
