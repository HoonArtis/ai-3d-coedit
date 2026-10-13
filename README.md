# AI 공간 꾸미기 — 웹 3D 협업 에디터

**다른 PC에서 시작할 때: [START_HERE.md](START_HERE.md)를 먼저 읽는다.**

고등학생 교육용 웹 3D 공간 꾸미기 프로그램. 구현 위치는 이 README가 있는 `.worktrees/implementation`이다.
언리얼 에디터식 배치·이동·회전·크기조절을 three.js(R3F)로 재현하고, 최대 5인이 한 맵을 함께 꾸민다.
학생마다 개인 AI 챗봇이 같은 명령 API로 씬을 조작하며, 완성본은 웹VR(퀘스트·피코)로 감상한다.

- 기획서: `index.html` (브라우저로 열기)
- 작성: 2026-10-13, 박형석(훈아티스), v0.1

## 로컬 구현 실행

Node24.11+, Docker Desktop, Ollama가 필요하다. 별도 터미널에서 실행한다.

```powershell
npm ci
docker compose -f infra/compose.yml up -d --wait
ollama pull qwen3:4b
npm run dev:server
# 별도 터미널
npm run dev:llm
# 별도 터미널: 생성/캐릭터/VR 완료 처리에 필요
npm run dev:cpu
# 별도 터미널: 로컬 CUDA 모델 설치 후
npm run dev:gpu
# 별도 터미널
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

http://127.0.0.1:4173 에서 에셋을 더블클릭하거나 끌어 놓는다. W/E/R 이동·회전·크기, F 선택보기, Ctrl+Z/Y 개인되돌리기. AI 요청은 로컬모델 큐를 거쳐 같은명령경로로 실행한다.

`/?login=1`에서 강사 등록/학생 방코드+ID 입장, `/?teacher=1`에서 수업·6개방 생성/30명발급/CSV. 수업 작업은 PostgreSQL에 저장한다. 익명 체험은 메모리방이므로 종료 시 초기화된다. PostgreSQL54329/Redis63799는 loopback이며 다른 프로젝트 DB와 분리했다. DB기본값은 로컬개발전용, 배포는 DATABASE_URL/ALLOWED_ORIGIN 설정을 사용한다.

검증: npm test, npm run build, npm run check:modules, npm run check:work, npm run test:e2e. 최초 E2E 전에 npx playwright install chromium. E2E는 별도2568/4174 포트를 사용하며 실제 LLM검증은 dev:llm 워커가 필요하다.

모델 평가 재현: npx tsx tools/evaluate-llm.ts. 결과는 docs/evidence/llm-evaluation.json. 클라우드는 기본 비활성이고 API실성능을 로컬결과로 대신하지 않는다.

진행상태와남은작업: [작업 계획](docs/work/PLAN.md). 완료 범위와 검증 증거는 장부를 따른다. 판매 라이선스 교체·감사와 헤드셋 실기기 검증은 사용자 요청으로 이번 범위에서 제외했다.

로컬 Ollama가 실행되어도 `/api/tags`가 비어 있고 로그에 `bad manifest` 경로 오류가 있으면 실제 모델 저장 경로를 확인한다. 이 PC에서는 junction 경로 대신 해당 프로세스의 `$env:OLLAMA_MODELS="D:/AI/ollama_models"`를 지정한 뒤 `ollama serve`로 복구했다. 다른 PC에서는 그 PC의 실제 경로를 사용한다. 가중치를 임의로 삭제하거나 다시 내려받지 않는다.

## 생성·캐릭터 및 검증 환경

GPU 준비는 [GPU 실행 안내](workers/gpu/README.md), 캐릭터 Blender 컨테이너는 [캐릭터 실행 안내](workers/characters/README.md)를 먼저 따른다. 캐릭터 변환·VR굽기·텍스처압축은 CPU 워커가 담당하며 `toktx` 실행 파일과 Docker가 필요하다. 이 PC에 검증된 모델/컨테이너가 준비돼 있다. 다른 PC의 CUDA/모델 환경까지 자동 설치됐다는 의미는 아니다.

학생은 생성 이미지를 확인한 뒤 3D 변환을 진행한다. 생성 텍스처가 실패하면 실패 상태에서 나무/금속/천을 직접 선택할 수 있으며 조용히 재질을 바꾸지 않는다. 강사 승인 후 라이브러리에서 명시적으로 배치한다. 캐릭터는 승인된 본인 최신 업로드를 VR 아바타로 사용한다.

[캐릭터 검증](docs/evidence/character.md), [PC 성능](docs/evidence/performance.md), [통합 회귀](docs/evidence/regression.md), [수업·HTTPS 검증](docs/evidence/acceptance.md). 실제 GPU 환경은 `docs/evidence/gpu-environment.json`에 기록했다. 모델 가중치·빌드 캐시·DB·학생 자격증명은 소스와 별개 로컬 데이터다.

실행 경로의 RMBG와 nvdiffrast 연구 제한은 그대로다. 판매용 경로가 완료되었다는 의미는 아니다. 헤드셋 없이 소프트웨어 HTTPS/WSS 감상과 서버 재시작을 검증했으며 Quest/PICO 착용 결과는 포함하지 않는다.

HTTPS 소프트웨어 재검증은 `.venv/Scripts/python.exe tools/create-test-certificate.py` 다음 `npx tsx tools/acceptance-https.ts`를 실행한다. 로컬2590/4186 포트를 임시 사용하며 종료 시 닫는다. 테스트 인증서는2일만 유효하고 운영 인증서로 사용하지 않는다. 30명 실제 수업 검증 `npx tsx tools/acceptance-class.ts`는 GPU모델을 실제 실행하므로 약20분 이상 걸릴 수 있다. 중간 실패의 격리 DB/체크포인트는 다음 실행에서 이어지며 성공 시 제거한다.

## 다른 PC에서 이어하기

[이전·비밀정보·실행 안내](docs/operations/migration-and-secrets.md)를 먼저 읽는다. Git clone만으로 기존 계정·작품·모델 가중치가 복원되지는 않는다. [외부 접속 아침 계획](docs/operations/external-access-plan.md)은 미실행 후속 작업이다.
