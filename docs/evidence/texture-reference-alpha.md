# 텍스처 참고 이미지 RGBA 전환 — 2026-10-14

[텍스처 외형 품질 진단](texture-quality-diagnosis.md)의 후보 세 가지(바닥 기준 메시, 흰 RGB 참고 이미지, 512px)를 같은 형상·seed로 하나씩 바꿔 비교했다. 다른 PC(RTX 3080 Ti 12GB)의 같은 Dockerfile 이미지(`TORCH_CUDA_ARCH_LIST=8.6`)와 같은 고정 리비전 모델을 썼다.

## 조건

- 입력: [고양이 구도 비교 이미지](image-composition/cat-after.png) → RMBG → TripoSG(seed42, 84,402면) → 데스크톱 감량 → MV-Adapter ig2mv(seed42, 텍스트 `high quality`).
- 12GB에서는 기본 model offload가 공유 메모리로 넘쳐 1 step에 300초가 걸렸다. 실험은 `TEXTURE_SEQUENTIAL_OFFLOAD=1`로 실행했다(최고 예약 약 8.3GB). 품질 비교에는 영향이 없고 속도만 다르다.
- 재현: `npx tsx tools/texture-ab.ts <dir>`, 렌더: `npx tsx tools/render-texture-ab.ts <dir> <variant...>`.

## 결과

| 변형 | 참고 이미지 | 해상도·step | 결과 |
|---|---|---|---|
| 기존 | 흰 배경 RGB 512 | 512·30 | 등 아래쪽 넓은 검은 띠, 과한 대비. 피카츄 "검은 뒷면"과 같은 증상 재현 |
| RGBA | 투명 배경 RGBA 768 | 512·30 | 검은 띠 사라짐, 6방향 색 일관 |
| RGBA+768 | 투명 배경 RGBA 768 | 768·50 | 위와 같고 털 디테일·측면 색이 조금 더 고름 |

- 6방향 중간 이미지: [기존](texture-reference-alpha/views-baseline.png), [RGBA](texture-reference-alpha/views-rgba.png), [RGBA+768](texture-reference-alpha/views-rgba-768-50.png)
- 최종 굽기 결과 0/90/180/270°: [비교](texture-reference-alpha/baked-comparison.png)

원인 해석: 공식 `inference_ig2mv_sdxl.py`는 RGBA 입력만 알파로 잘라 90% 크기·회색(0.5) 배경으로 맞춘다. 흰 RGB를 넘기면 이 전처리를 건너뛰어 학습 분포와 다른 참고 이미지가 들어간다.

## 기각한 가설

메시 중심 정렬은 효과가 없었다. `gltf-transform`의 `center()`는 노드 변환만 바꾸고, MV-Adapter는 trimesh로 원래 정점을 읽는다. TripoSG 정점은 이미 원점 중심(±0.95)이라 두 입력이 같은 메시로 처리되어 결과가 픽셀 단위로 같았다. 코드에서 되돌렸다.

## 적용과 남은 확인

- 적용: 텍스처 단계 배경 제거에 `--rgba`를 넘겨 투명 RGBA 768 참고 이미지를 쓴다(`gpu-worker.ts`, `background.py`). 형상 단계 입력(흰 RGB 512)은 그대로다.
- 기본값은 512·30을 유지한다. 서버(16GB)는 512에서 이미 최고 예약 11.6GB였으므로 768·50은 서버에서 메모리·시간을 실측한 뒤 결정한다. 넘치면 `TEXTURE_SEQUENTIAL_OFFLOAD=1`이 대안이다.
- 미검증: 고양이 한 사례다. 피카츄 원본과 다른 물체(의자 등 비생물)는 서버 PC에서 같은 도구로 재확인한다. 위·아래 방향 번짐은 이번 변경 범위 밖이다.

## 피카츄 확인 (같은 날)

SDXL로 새로 만든 피카츄(seed 31337, 단일 전신)로 같은 비교를 했다. seed42는 여러 피카츄 콜라주가 나와 쓸 수 없었다.

- RGBA로 바꿔도 등 아래·엉덩이의 검정·빨강은 남았다. 머리 뒤·한쪽 옆구리만 노랗게 돌아왔다. 고양이와 달리 **보이지 않는 면을 모델이 지어내는 문제**가 따로 있다.
- 텍스처 텍스트에 "등까지 노란 털" 설명을 넣어도 거의 변화가 없었다. 이미지 조건 모드에서 텍스트는 뒷면을 좌우하지 못한다.
- SDXL에 뒷모습을 요청해도 4개 seed 모두 정면이나 콜라주였다: [시도](texture-reference-alpha/sdxl-back-view-attempts.png). 현재 이미지 모델로 뒷모습 자동 생성은 안 된다.
- 6방향 중 뒷면(180°) 칸만 몸 색으로 바꿔 다시 구우면(`workers/gpu/bake_views.py`) 정뒷면은 노랗게 붙고 큰 이음새는 없었다. 하지만 좌우(90°/270°) 칸이 지어낸 엉덩이의 검정·빨강이 남는다: [비교](texture-reference-alpha/pikachu-back-shown.png). 뒷면을 보여주려면 뒷면 한 칸이 아니라 좌우 칸의 뒤쪽 절반까지 함께 다뤄야 한다.
