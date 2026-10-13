# 라이선스 기록 (원본)

새 모델·라이브러리를 들이면 이 표에 한 줄을 추가한다. 코드, 가중치, 그리고 **자동으로 끌려오는 의존물**을 각각 적는다. 조사일: 2026-10-13.

| 부품 | 라이선스 | 판매 | 비고 |
|---|---|---|---|
| TripoSG (코드·가중치) | MIT | 가능 | 이미지 → 형상만, VRAM 8GB+, 기본 50 steps |
| MV-Adapter (코드·가중치) | Apache-2.0 | 가능 | VAST 공식 데모가 TripoSG 텍스처에 사용. SDXL판 VRAM 16GB+, SD2.1판 10GB 미만 |
| **RMBG-1.4** (TripoSG 기본 배경 제거) | 비상업 전용 | **불가** | 상업은 BRIA 계약. 상업 가능한 배경 제거 모델로 교체 필요 |
| **nvdiffrast** (텍스처 렌더링) | NVIDIA Source Code License, 연구·평가 전용 | **불가** | 대부분의 오픈 텍스처 파이프라인이 의존. 대체 경로 또는 NVIDIA 계약 |
| SDXL (MV-Adapter 기반) | CreativeML Open RAIL++-M | 조건부 | 원문 권리 부여/Attachment A/재배포 의무 확인. 전체 체인 판매 승인은 아님 |
| TRELLIS.2 (텍스처 대안) | MIT | 미확인 | VRAM 24GB+. nvdiffrast·DINOv3 의존 |
| Hunyuan3D-2 / 2.1 | Tencent 라이선스 | **사용 금지** | 한국이 사용 지역에서 제외 |
| FLUX.1-schnell (이미지 모델 후보) | Apache-2.0 | 가능 | 최종 선정 전. FLUX.1-dev는 비상업 |
| @react-three/xr 6.6.31 | MIT | 가능 | 실제 npm LICENSE 확인, 고지 보존. peer React ≥18, Fiber ≥8 |

출처: github.com/VAST-AI-Research/TripoSG · huggingface.co/VAST-AI/TripoSG · github.com/huanngzh/MV-Adapter · huggingface.co/briaai/RMBG-1.4 · github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt · github.com/microsoft/TRELLIS.2 · huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE

## 웹·서버 개발 의존물

직접 의존물의 버전·공식 배포 출처는 [선정 기록](decisions/dependencies.md), 원본 응답은 [메타데이터](evidence/dependency-metadata.json)에 있다. 설치 후 전이 의존물은 별도 evidence로 남긴다. npm 선언을 전체 제품의 판매 승인으로 해석하지 않는다.

| 추가 실제 런타임 | 라이선스 | 원문/배포 근거 |
|---|---|---|
| pg 8.23.1, @types/pg 8.23.1 | MIT | https://registry.npmjs.org/pg/8.23.1 |
| express 5.3.0 | MIT | https://registry.npmjs.org/express/5.3.0 |
| PostgreSQL17 공식 Docker | PostgreSQL + 기반 이미지 각 조건 | https://www.postgresql.org/about/licence/ ; https://hub.docker.com/_/postgres |

개발 DB image digest는 infra/compose.yml에 고정했다. 코드/서버/컨테이너 전이 조건은 판매 감사에서 별도로 대조한다.

모델 상세·자동 의존물·고정 revision과 후속 설치 게이트: [모델 선정 조사](decisions/models.md). Qwen3-4B 가중치 Apache-2.0, Ollama qwen3:4b 설치 digest 기록. BiRefNet/RealESRGAN/big-lama/VAE/encoder의 추가 구성은 자동으로 판매 승인하지 않는다.

| 큐 신규 의존 | 라이선스 | 출처 |
|---|---|---|
| BullMQ6.3.14 | MIT | https://registry.npmjs.org/bullmq/6.3.14 |
| ioredis6.0.0 | MIT | https://registry.npmjs.org/ioredis/6.0.0 |
| Redis7.2 Docker | BSD-3-Clause (Redis7.2 계열), 기반 이미지 별도 | https://redis.io/legal/licenses/ |

Redis는 loopback63799, AOF always/noeviction이며 Docker digest는 compose에 고정했다. 다른 Redis 버전의 라이선스를 동일시하지 않는다.

## GPU 설치 시 추가 발견

- DISO0.1.4: CC BY-NC4.0. [공식 LICENSE](https://github.com/SarahWeiii/diso/blob/main/LICENSE). 도입하지 않고 TripoSG 공식 `use_flash_decoder=False` 경로를 사용한다. 최상위 차단 목록에 추가했다.
- Trimesh5.1.1 MIT, OmegaConf2.4.0 BSD, jaxtyping0.3.11 MIT, scikit-image0.26.0 BSD-3 및 배포물별 고지. PyPI 버전/원문 메타데이터는 gpu-dependency-metadata.json.
- pymeshlab2025.7.post1 GPL3은 조사만 했고 설치하지 않았다. DISO도 설치하지 않았다.
- SDXL-base1.0 fp16 revision462165984030d82259a11f4367a4eed129e94a7b 다운로드. 기본 모델/CLIP·OpenCLIP text encoder/VAE가 같은 snapshot에 포함. 추론용 패키지는 .venv에 분리하며 기존 torch2.11.0+cu128/diffusers0.40.0/transformers5.16.1을 읽기만 재사용. 전역 패키지를 덮어쓰지 않는다.

- sharp 0.35.5: Apache-2.0, 업로드 PNG/JPEG/WebP 디코딩/검증. 배포된 libvips 번들의 의존 라이선스 notices를 함께 보존한다. 설치 audit 0건. 공식 입력 상한 문서: https://sharp.pixelplumbing.com/api-constructor/

## 2026-10-13 후처리 도입

- @gltf-transform/core/functions/extensions 4.5.1 및 meshoptimizer 1.3.0: npm 실제 metadata MIT. 메시 감량/GLB 검사. audit0.
- KTX-Software 4.4.2: 원본 대부분 Apache2.0, 추가 의존물은 개별조건. 공식 Windows installer를 실행하지 않고 `.cache/ktx`로 추출. 다운로드 SHA256 공식asset digest와 일치(ktx-download.json). toktx ETC1S 인코더만 사용. libktx의 etcdec는 별도 Ericsson 조건이며 전체 번들을 단일 Apache로 판정하지 않는다. 배포 감사에서 번들 notices/불필요한 decoder 포함 여부 확인 필요. https://github.com/KhronosGroup/KTX-Software/blob/main/LICENSE.md
- MV 텍스처 실험용 Linux container: pytorch2.7.1 CUDA12.8 devel digest3d614dfd…(Dockerfile전체값). NVIDIA Deep Learning Container License가 적용된다. 호스트 GPU/드라이버 변경 없이 Docker GPU접근 실측성공. https://developer.nvidia.com/ngc/nvidia-deep-learning-container-license
- Linux 연구 환경의 pymeshlab2023.12.post3는 GPL3이며 판매 경로에 넣지 않는다. open3d0.19 MIT, spandrel0.4.1 MIT, CV-CUDA0.18 Apache2.0, gltflib1.0.13 MIT. nvdiffrast 연구 제한 유지. 의존물 원문/설치목록 감사 결과를 후속 manifest에 포함한다.
- madebyollin/sdxl-vae-fp16-fix: HF 모델카드 MIT, revision207b116dae70ace3637169f1ddd2434b91b3a8cd. MVAdapter와 SDXL원본의 별도조건은 그대로 유지. https://huggingface.co/madebyollin/sdxl-vae-fp16-fix

- 브라우저 KTX2 디코더: three0.186.1에 포함된 Basis Universal JS/WASM, Apache2.0(동봉 README). `prepare-web-assets.ts`가 버전 고정 npm 파일과 공식 LICENSE 사본을 빌드에 복사한다. 원문 https://github.com/BinomialLLC/basis_universal/blob/master/LICENSE , 보존 docs/licenses/basis-Apache-2.0.txt.

## 2026-10-14 WebXR 도입

- @react-three/xr, @pmndrs/xr, @pmndrs/pointer-events **6.6.31**: npm metadata는 SEE LICENSE이나 설치된 LICENSE 원문은 MIT. 저작권 Bela Bohlender2024 및 원문을 docs/licenses/*-MIT.txt에 보존했다. npm lock으로 버전 고정.
- 전이 의존 IWER2.6.0, @iwer/devui1.1.2, @iwer/sem0.2.5는 설치 package.json상 MIT. 에뮬레이터는 실제기기 검증으로 오인하지 않도록 제품 store에서 `emulate:false`. 전체 번들별 notices 및 모델 자산은 LIC-03 최종 감사 대상이다.
- npm install --ignore-scripts 후312패키지 audit0. FontAwesome react0.2.2 전이 의존의 지원 종료 경고는 기록하되 XR고정버전을 임의 변경하지 않는다.
- 구현 원문: https://pmndrs.github.io/xr/docs/getting-started/introduction , https://pmndrs.github.io/xr/docs/tutorials/teleport . 설치6.6.31 store.d.ts의 offerSession/enterGrantedSession/emulate 기본값을 확인하고 모두 false로 명시했다. `enterVR`은 사용자 버튼 핸들러 안에서만 호출한다.

- MV-Adapter TG2MV SDXL 재질 실험: 기존HF revision6de4033df6b53366f3c009d22f5ec434bb55e59f와Apache2 모델카드 사용. 새파일 mvadapter_tg2mv_sdxl.safetensors, size1963750672, 공식LFS SHA256 d8bbe3e73f211fb86c83de3080410fa1b7574433f6bb0f0da88031d0ee5404e2. 기존SDXL/VAE/nvdiffrast조건을그대로적용하며상업허용으로바꾸지않는다.

## 캐릭터 변환 — 2026-10-14

Blender5.1.2 Linux 공식 바이너리: https://download.blender.org/release/Blender5.1/blender-5.1.2-linux-x64.tar.xz . 공식 .sha256 원문과 다운로드SHA256 aaccb355f50183979b698bcce7467103a76261b5fa59f4972295842662a285fb 일치. 독립 프로세스 컨테이너에서 사용하며 웹 번들에 포함하지 않는다. Blender 자체 원문은 GPL-2.0-or-later, 배포에 포함된 의존물은 GPL3 이상과 호환되는 여러 조건이다(copyright.txt 및 license/license.md). 배포 묶음은 GPL3 호환 조건으로 관리하고 원문/소스 제공 의무를 유지한다. 생성한 모델에 Blender 라이선스가 자동 적용되지는 않는다. 업로드한 모델·텍스처 자체 권리는 업로더가 확보해야 하며 판매 허용으로 자동 판정하지 않는다. 공식 안내 https://www.blender.org/about/license/ .

검증 FBX/GLB는 tests/fixtures/create_character.py로 직접 만든 2관절 타원체와 Idle 클립이며 외부 믹사모 캐릭터를 재배포하지 않는다. 파일은 tests/fixtures/characters에 고정했다. Blender 컨테이너는 네트워크 없음·읽기 전용 루트·비특권 사용자·입력/출력/단일 스크립트만 mount·메모리4GB/CPU2/시간180초 제한이다.
