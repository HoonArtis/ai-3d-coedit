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

## TRELLIS-image-large 비교 (같은 날, 실험만)

같은 RGBA 참고 이미지를 TRELLIS-image-large(MIT, seed1)에 넣어 형상·텍스처를 한 번에 만들었다. 실험 환경은 `.cache/trellis-image`(Git 제외)이며 제품 코드에는 넣지 않았다.

- 시간: 물체당 약 45~52초(3080 Ti). 현재 경로는 이 PC에서 형상 64초 + 텍스처 약 265초다.
- 메모리: 최고 예약 약 13.6~13.9GB. 12GB에서는 생성 모델을 CPU로 내린 뒤 굽기를 해야 한다(그러지 않으면 굽기가 1 it/s로 떨어진다). 서버 16GB에는 맞을 것으로 보이나 미실측.
- 결과: [피카츄](texture-reference-alpha/trellis-pikachu.png), [고양이](texture-reference-alpha/trellis-cat.png). 뒷면이 앞과 같은 계열 색으로 이어져 검은 띠는 없다. 피카츄 엉덩이의 검정·빨강 무늬와 꼬리가 몸에서 떨어진 판으로 나오는 형상 문제는 있다. 고양이는 자세가 원본과 다르게(웅크린 형태) 해석됐다.
- 출력 GLB는 `metallicFactor`가 없어 glTF 기본값 1(금속)로 읽힌다. 통합하면 0으로 고쳐야 한다.
- 라이선스: 모델·코드 MIT. 굽기에 nvdiffrast(연구용, 현재 경로와 같음)와 Inria `diff-gaussian-rasterization`(비상업)을 쓴다. 판매 경로라면 후자를 gsplat(Apache-2.0) 등으로 바꿔야 한다.

## 뒷면 검정·빨강의 출처 (2026-10-15)

SDXL 원본 이미지에서 볼 뒤 옆구리(몸이 뒤로 넘어가는 윤곽)에 검정·빨강 띠가 이미 그려져 있었다: [확대](texture-reference-alpha/pikachu-source-edge-patch.png). 실제 피카츄에 없는 무늬다. MV-Adapter와 TRELLIS가 서로 다른 모델인데도 같은 자리에 같은 색을 칠한 것은 이 윤곽 단서를 안 보이는 등 전체로 늘렸기 때문이다. 윤곽 근처의 작은 이상 색이 3D에서는 뒷면 전체로 커진다. 근본 원인은 텍스처 모델보다 이미지 단계의 지어낸 세부다. 대응 후보: 이미지 모델 교체·후보 선택, 확인 단계 안내, 윤곽 근처 이상 색 자동 경고(귀 끝처럼 원래 있는 무늬의 오탐 조정 필요).

검증: 같은 원본에서 옆구리 띠만 OpenCV 인페인트로 지운 이미지([전후](texture-reference-alpha/pikachu-clean-patch.png))를 TRELLIS에 넣자 뒷면·엉덩이의 검정·빨강이 완전히 사라지고 노란색으로 이어졌다: [비교](texture-reference-alpha/pikachu-clean-trellis.png)(위 원본, 아래 수정본). 원인 가설이 확인됐다. 꼬리가 몸에서 떨어진 판으로 나오는 형상 문제는 그대로 남는다.

## 이미지 모델 비교: SDXL / Qwen-Image-2512 / HiDream-O1-Image-Dev (2026-10-15, 평가만)

같은 "Pikachu" + 고정 구도 문구, seed 31337, 이 PC(RTX 3080 Ti 12GB) 각 1장: [비교](texture-reference-alpha/image-models-pikachu.png) (왼쪽부터).

| 모델 | 라이선스 | 이 PC 설정·시간 | 관찰 |
|---|---|---|---|
| SDXL base 1.0 | RAIL++-M | 768², 25 step, 약 20초 | 매끈한 피규어 느낌, 3/4 시점. 옆구리 지어낸 검정·빨강 띠(뒷면 검정의 원인) |
| Qwen-Image-2512 | Apache-2.0 | GGUF Q3_K_M + 4bit 텍스트 인코더, 1024², 30 step, 1,220초 | 설정에 맞는 피카츄(꼬리 끝·등 갈색 줄), 흰 배경 지킴, 지어낸 무늬 없음. 실사 털, 정면에 가까움 |
| HiDream-O1-Image-Dev | MIT | 8bit + SDPA 대체, 1024², 28 step, 993초 | 3/4 시점 가장 정확, 설정 맞음. "흰 배경"을 무시하고 돌바닥 배경. 실사 털 |

- 둘 다 이 PC에서는 VRAM이 넘쳐 한 장 15~20분으로 수업에 쓸 수 없다. 서버 16GB와 고속 설정(Qwen Lightning 8 step 등)에서 재측정해야 한다.
- Qwen-Image-2.1은 연구·평가 전용 라이선스라 제외했다. OpenAI는 공개 이미지 가중치가 없고, API(Codex 이미지 도구)는 피카츄 요청을 안전 정책으로 거절했다.
- 표본이 1장씩이다. 결론이 아니라 후보 선별용이다.

## TripoSG 형상 해상도 (2026-10-15)

형상이 어설퍼 보이는 원인은 5천 삼각형 감량보다 TripoSG 원본의 계단형 등고선이었다. 우리 설정(hierarchical 디코더 깊이 6/7 = 128³, 30 step)은 공식 기본값(8/9 = 512³, 50 step)보다 거칠었다. 같은 피카츄 입력(seed42, 이 PC)으로 비교했다.

| 설정 | 삼각형 | 시간 | 최고 예약 | 결과 |
|---|---:|---:|---:|---|
| 6/7, 30 step (기존) | 73,020 | 64초 | 5.8GB | 몸통·귀에 계단 줄무늬 |
| 7/8, 50 step (채택) | 290,952 | 31초* | 5.8GB | 줄무늬 사라짐 |
| 8/9, 50 step (공식) | 1,164,280 | 62초 | 6.3GB | 7/8과 눈에 띄는 차이 없음 |

*모델이 이미 메모리에 올라간 상태의 측정이라 기존 64초(로딩 포함)와 직접 비교하지 않는다. 7/8 결과의 데스크톱 감량(290,952→4,900)은 552ms였고, 감량 후에도 기존보다 매끈했다: [감량 후 비교](texture-reference-alpha/triposg-depth-5k.png)(위 기존, 아래 7/8). 꼬리가 얇은 판인 것은 입력 그림에서 꼬리가 비스듬히 보인 탓이라 설정과 무관하다. 서버 시간은 미실측이다.

## SDXL 4장 후보와 텍스처 설정 (2026-10-15)

- SDXL "Pikachu" 4 seed: [후보](texture-reference-alpha/sdxl-four-candidates.png). 303 바로 사용 가능, 101 사용 가능, 202 콜라주, 404 흰 얼굴. 이 PC에서 장당 59~85초(작업마다 모델을 다시 불러옴).
- 303(지어낸 무늬 없음)은 뒷면이 노랗게 이어졌다. 101은 원본 오른쪽 윤곽에 짙은 그림자가 있어 뒷면 전체가 남색·회색이 됐다: [101](texture-reference-alpha/edge-shadow-101.png). 윤곽의 그림자도 지어낸 무늬처럼 뒷면으로 번진다.
- 303 텍스처 설정 비교: [비교](texture-reference-alpha/texture-settings-303.png)(위부터 512·30 / 768·50 / 공식 마무리 / 768·50+공식 마무리). 768·50은 정면이 조금 선명하지만 등이 은회색으로 더 칙칙했다. 공식 마무리(RealESRGAN BSD-3 + LaMa Apache-2.0, `TEXTURE_FINISH=official`)는 옆 얼룩이 조금 줄어든 정도다. 꼬리 판 뒷면 검정은 모든 설정에서 남았다.
- 굽기 전에 정면 외 5방향의 색을 정면 색 분포로 맞추면(Lab Reinhard, 밝기 절반만) 회색 등이 노란 계열로 바뀌었다: [비교](texture-reference-alpha/colormatch-303.png)(위 기존, 아래 보정). 꼬리 뒷면은 어두운 갈색으로 남았다. 실험 코드는 아직 제품 경로에 넣지 않았다.
