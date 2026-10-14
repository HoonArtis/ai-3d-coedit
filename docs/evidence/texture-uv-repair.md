# 고양이 텍스처 실패 재현·복구 — 2026-10-14

## 원인과 동일 조건 비교

고양이 형상과 6방향 이미지는 만들어졌지만 Open3D UVAtlas의 표면 펼치기가 `UVAtlasPartition failed with code 0x80004005`로 실패했다. 자동 재시도도 같은 결과였다. 프롬프트나 이미지 제한이 원인이 아니다.

실패한 원본과 기존 view 이미지를 보존하고 같은 Linux 텍스처 컨테이너에서 CPU 전처리를 재현했다. 입력 4,900면에는 중복면 8개가 있었고, MV-Adapter의 표면 정리 후 4,887면 중 8개의 면적이 약 1e-14로 붕괴했다. 이 상태에서 UVAtlas 실패를 재현했다. UVAtlas와 같은 float32 정밀도로 측정하고 크기 정규화 후 극소 삼각형 8개만 제외하니 4,879면의 UV 생성이 통과했다. 남긴 정점 좌표와 면 순서는 바꾸지 않는다.

오류 코드만으로 특정 원인을 단정하지 않았다. [Open3D 구현](https://github.com/isl-org/Open3D/blob/main/cpp/open3d/t/geometry/kernel/UVUnwrapping.cpp), [UVAtlasPartition 반환값](https://github.com/microsoft/UVAtlas/wiki/UVAtlasPartition), [Open3D의 non-manifold 사례](https://github.com/isl-org/Open3D/issues/7013)를 조사하고 실제 파일의 대조 실험으로 보정 위치를 확인했다. 마지막 사례는 오류 코드가 달라 동일 원인으로 취급하지 않았다.

## 적용·검증

- `workers/gpu/uv_mesh.py`: NumPy 기반 독립 보정. float32 변환 후 상대 면적 검사, 비유한/빈 결과 거부.
- `prepare_vendor --texture`: 고정 MV-Adapter revision의 UV 생성 직전에 연결. 캐시만 수정하는 방식이 아니며 재설치/다른 PC에서도 재적용된다. 반복 실행도 통과했다.
- 원래 실패 작업을 기존 GPU 큐에서 재실행: 텍스처 단계 74.064초, 실제 텍스처 GLB 905,224바이트. 정점/UV 유한, 4,879면, 텍스처 4096×4096.
- 기본 재질 대체 없이 감량까지 완료. 후속 승인 단계 제거 적용 후 개인 에셋으로 등록됐다. 공개 HTTPS History에서 실제 모델 렌더링과 배치 버튼 활성화를 확인했다. 검사 중 장면 배치/공유 명령은 보내지 않았다.
- Python 어댑터 회귀 14개 통과. 매우 작거나 큰 좌표계, float32에서 붕괴하는 면, 원본 불변, 완전히 퇴화한 메시의 실패를 검증했다.

모듈화: 보정은 GPU 어댑터 내부의 순수 함수이며 서버/UI/권한 경로에 의존하지 않는다. UV 실패를 성공으로 숨기거나 임의 재질로 바꾸지 않는다. 모든 모델의 기하 품질을 보장하는 수정은 아니다.
