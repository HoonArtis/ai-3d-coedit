# 모델·XR 선정 근거 (2026-10-13)

## 로컬 LLM

Qwen3-4B를 우선 평가한다. 공식 가중치 Apache-2.0, upstream revision `1cfa9a7208912126459214e8b04321603b3df60c`. Ollama 0.40.0에서 `qwen3:4b` Q4_K_M 2,497,293,931 bytes 설치를 API로 확인했다. digest `359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7`. 이 PC는 RTX 5060 Ti 16GB다. 실제 선택 성능은 별도 20문항 평가로 판정한다. 코드 실행 adapter는 Node fetch이며 Python transformers를 LLM 서버에 추가하지 않는다.

- [공식 가중치와 라이선스](https://huggingface.co/Qwen/Qwen3-4B)
- [실행 배포](https://ollama.com/library/qwen3:4b)
- [구조화 출력](https://docs.ollama.com/capabilities/structured-outputs)
- 클라우드 차선(Claude Haiku adapter)은 2026-10-15 사용자 지시로 코드에서 제거했다. 챗봇 모델은 로컬 Ollama 하나다.

## 이미지

FLUX.1-schnell의 공식 가중치 Apache-2.0과 공개 배포를 확인했다. revision `741f7c3ce8b383c54771c7003378a50191e9efe9`. FLUX.1-dev와 다른 모델이다. [모델 카드](https://huggingface.co/black-forest-labs/FLUX.1-schnell). 대형 모델이므로 16GB 환경에서 offload/양자화/시간 실측 후 최종 채택한다. CLIP/T5 encoder·VAE 등 실행 snapshot 구성과 라이선스를 설치 시 다시 고정한다. 다운로드·이미지 생성 성공을 아직 주장하지 않는다.

SDXL의 [원문](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/blob/main/LICENSE.md)은 CreativeML Open RAIL++-M이다. 상업을 일괄 금지하지 않으나 사용 제한과 재배포 고지, 하위 사용자에게 제한 전달 의무가 있다. Attachment A 준수 및 전체 체인의 제한이 필요하다. MV-Adapter 전체가 판매 가능하다는 결론은 아니다.

## GPU 자동 의존물

TripoSG 코드 MIT, 가중치 MIT revision `2c1c516d22d58db486a058d98d31bb6177344e06`. [공식 스크립트](https://github.com/VAST-AI-Research/TripoSG/blob/main/scripts/inference_triposg.py)는 TripoSG와 **briaai/RMBG-1.4를 각각 snapshot_download** 한다. 기본 실행은 BRIA 가중치까지 가져온다. [RMBG 조건](https://huggingface.co/briaai/RMBG-1.4)은 비상업/상업 별도 계약이다. 자동 의존이라고 면제되지 않는다. requirements의 numpy1.22.3, diso, pymeshlab 등은 Python/CUDA 호환성과 배포 라이선스를 실제 설치 시 별도 고정한다.

MV-Adapter 코드 Apache-2.0, 가중치 Apache-2.0 revision `6de4033df6b53366f3c009d22f5ec434bb55e59f`. 코드 조사 commit `4277e0018232bac82bb2c103caf0893cedb711be`. [requirements](https://github.com/huanngzh/MV-Adapter/blob/4277e0018232bac82bb2c103caf0893cedb711be/requirements.txt)는 nvdiffrast Git 설치를 포함한다. [texture_i2tex](https://github.com/huanngzh/MV-Adapter/blob/4277e0018232bac82bb2c103caf0893cedb711be/scripts/texture_i2tex.py)의 기본 SDXL 경로는 아래를 사용한다.

- stabilityai/stable-diffusion-xl-base-1.0, madebyollin/sdxl-vae-fp16-fix, huanngzh/mv-adapter.
- remove_bg 선택 시 ZhengPeng7/BiRefNet, trust_remote_code=True. 코드 검토·revision 고정 전에 원격 코드를 실행하지 않는다.
- 로컬 체크포인트 RealESRGAN_x2plus.pth와 big-lama.pt. 코드 라이선스를 가중치까지 확대 해석하지 않으며, 각각 다운로드 출처·가중치 조건 확인이 설치 게이트다.
- spandrel0.4.1, open3d, pymeshlab, cvcuda_cu12 및 requirements 목록은 `docs/evidence/upstream/mvadapter-requirements.txt`에 보관했다.
- [nvdiffrast 원문](https://github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt)의 연구/평가 비상업 제한 때문에 이 경로는 판매 빌드에서 차단한다. 미리 만든 재질 프리셋 대안을 원본 범위대로 별도 구현한다.
- Hunyuan3D-2/2.1은 최상위 결정대로 도입하지 않는다. [지역 조건 원문](https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE).

GPU 조사 완료와 GPU 설치/생성 성공은 다른 판정이다. GPU 모델의 확정 설치 manifest 및 실측은 GEN 티켓의 게이트로 유지한다.

## XR

@react-three/xr 6.6.31의 npm 실제 tarball LICENSE를 읽었다. MIT, Copyright 2024 Bela Bohlender. npm metadata의 SEE LICENSE IN LICENSE는 불명확 상태가 아니라 원문 파일 참조다. 복사본 `docs/evidence/xr-license.txt`. [배포 tarball](https://registry.npmjs.org/@react-three/xr/-/xr-6.6.31.tgz), [공식 문서](https://pmndrs.github.io/xr/docs/getting-started/introduction).

peer react/react-dom >=18, fiber >=8, three *. 현재 React19.3/Fiber9.8.1/Three0.186.1은 선언 범위에 든다. 선언 범위 확인이 실제 Quest/PICO 통과를 대신하지 않는다. 설치 후 타입·브라우저 실행은 VR-01, 기기 실측은 VR-03에서 한다.
