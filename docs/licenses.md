# 라이선스 기록 (원본)

새 모델·라이브러리를 들이면 이 표에 한 줄을 추가한다. 코드, 가중치, 그리고 **자동으로 끌려오는 의존물**을 각각 적는다. 조사일: 2026-10-13.

| 부품 | 라이선스 | 판매 | 비고 |
|---|---|---|---|
| TripoSG (코드·가중치) | MIT | 가능 | 이미지 → 형상만, VRAM 8GB+, 기본 50 steps |
| MV-Adapter (코드·가중치) | Apache-2.0 | 가능 | VAST 공식 데모가 TripoSG 텍스처에 사용. SDXL판 VRAM 16GB+, SD2.1판 10GB 미만 |
| **RMBG-1.4** (TripoSG 기본 배경 제거) | 비상업 전용 | **불가** | 상업은 BRIA 계약. 상업 가능한 배경 제거 모델로 교체 필요 |
| **nvdiffrast** (텍스처 렌더링) | NVIDIA Source Code License, 연구·평가 전용 | **불가** | 대부분의 오픈 텍스처 파이프라인이 의존. 대체 경로 또는 NVIDIA 계약 |
| SDXL (MV-Adapter 기반) | CreativeML Open RAIL++-M | 미확인 | 사용 제한 조항 준수 시 상업 가능한 것으로 알려짐. 원문 확인 필요 |
| TRELLIS.2 (텍스처 대안) | MIT | 미확인 | VRAM 24GB+. nvdiffrast·DINOv3 의존 |
| Hunyuan3D-2 / 2.1 | Tencent 라이선스 | **사용 금지** | 한국이 사용 지역에서 제외 |
| FLUX.1-schnell (이미지 모델 후보) | Apache-2.0 | 가능 | 최종 선정 전. FLUX.1-dev는 비상업 |
| @react-three/xr 6.6.31 | (확인 필요) | - | peer: react ≥18, @react-three/fiber ≥8 |

출처: github.com/VAST-AI-Research/TripoSG · huggingface.co/VAST-AI/TripoSG · github.com/huanngzh/MV-Adapter · huggingface.co/briaai/RMBG-1.4 · github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt · github.com/microsoft/TRELLIS.2 · huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE
