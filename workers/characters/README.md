# 리깅 캐릭터 변환

Blender 5.1.2 Linux 공식 tar.xz를 `.cache/blender/blender-5.1.2-linux-x64.tar.xz`에 둔다. 공식 다운로드는 https://download.blender.org/release/Blender5.1/ 이며 Dockerfile이 SHA256을 검증한다.

```powershell
docker build -f workers/characters/Dockerfile -t coedit-character:5.1.2 .cache/blender
npm run dev:cpu
npx vitest run tests/integration/character-conversion.test.ts tests/tickets/character-instance.test.ts
```

64MB 이하 binary FBX/내장 리소스 GLB를 받는다. Docker는 네트워크 차단, 읽기 전용 루트, 4GB/CPU2/180초 제한으로 실행한다. desktop 5천/아바타1만/정적 VR 2500 삼각형 이하, 높이1.7m로 변환한다. 128관절/4스킨 이하, 정규화된 가중치와 유한한 관절·클립 데이터를 검사한다. morph target은 받지 않는다. 클립이 없으면 고정 자세를 사용한다. 미승인·잘못된 캐릭터는 다른 사용자에게 배포하지 않는다.

VR은 업로드한 본인 캐릭터 중 최신 승인본을 사용한다. 머리 관절을 찾지 못하거나 파일 접근이 실패하면 기본 머리와 별도 손으로 표시한다. 전문 리타기팅/전신 IK는 범위 밖이다. 실제 헤드셋 검증은 사용자 요청으로 제외했다.

테스트 FBX/GLB는 `tests/fixtures/create_character.py`로 자체 생성했으며 외부 Mixamo 자료를 포함하지 않는다. 업로드 콘텐츠 권리는 업로더가 확보해야 한다. 변환기 코드 라이선스와 콘텐츠 권리는 별개이며 docs/licenses.md를 따른다.
