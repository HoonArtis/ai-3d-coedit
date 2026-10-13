# 기존 객체 재질 변경 및 프리셋 검증 — 2026-10-14

기존 객체의 승인 원본 기하와 새 재질 설명을 공식 MV-Adapter TG2MV에 입력한다. 일반 신규 생성의 이미지 확인→형상→IG2MV 경로는 유지한다. 요청 당시 객체 ID/revision/generation/assetId를 고정하고, 승인 결과는 명시적 replace_asset 공통 명령으로 적용한다. 권한·잠금·세대·revision을 다시 검사하고 undo는 원래 에셋으로 복원한다.

실제 큐 실험은 154.640초, 텍스처 추론 자체는 142.345초였다. 4,842삼각형, 드로콜1, 1024 KTX2를 배포했다. 원본 배치1회+재질변경1회로 사용량2/3, stale 결과 거절, 적용seq2, undo seq3 확인. `retexture-gpu.json`, `retexture-comparison.png`, `.superpowers/sdd/PLAN/retexture-tg-queue.log`에 기록. 렌더 이미지를 직접 확인했으며 붉은 목재 재질이 전체 기하에 적용됐다. 모든 프롬프트의 품질을 보장하는 검증은 아니며 강사 승인을 유지한다.

## 두 차례 품질 실패와 해결 사례

기존 이미지 조건은 파랑을 유지(106.576초), 새 SDXL 참고 이미지는 콜라주로 UV 불일치(168.439초)였다. `retexture-gpu-old-reference.json`, `retexture-gpu-new-reference.json`에 보존했다. 공식 [MV-Adapter text-to-texture](https://github.com/huanngzh/MV-Adapter/blob/main/scripts/texture_t2tex.py)와 로컬 고정 소스를 조사하고 TG2MV로 비교했다. 단독 실험120.302초, 같은 큐 재실행154.640초에서 해결을 확인했다. `retexture-text-geometry.png`가 단독 실험 결과다. 어댑터 revision/해시는 licenses.md에 기록했다. nvdiffrast 연구 제한은 유지한다.

## 검증 및 모듈화

- 전체 단위/PG/Redis 통합186개 PASS: `.superpowers/sdd/PLAN/retexture-final-tests.log`.
- 전체 브라우저26개 PASS: `.superpowers/sdd/PLAN/retexture-final-browser.log`. 실제 KTX2 승인·배치·replace_asset·undo 포함.
- 타입 및 모듈 경계 검사 PASS, Python7개 및 빌드 PASS. 의도적 RED 후 repository 상태 및 target outbox 테스트 통과.
- 프리셋은 텍스처 실패를 material_choice로 표시하고 소유자가 명시적으로 선택한다. wood/metal/fabric 각각 기존 여러 재질을 단일 재질로 교체. 잘못된 프리셋/타인 선택/선택 변경 거절, 추가 차감 없음. tests/integration/material-preset 및 generation-finishing, 브라우저 생성 실패 경로 검증.
- UI는 요청/표시, 도메인은 공통 명령 권한/잠금/이력, repository는 사용량/버전/outbox, 워커는 모델/감량/배포만 담당한다. geometry/export는 명시적인 서버용 공개 subpath이며 NodeIO를 브라우저로 가져오지 않는다. 반복 권한 로직을 만들지 않고 canWrite를 사용한다.
