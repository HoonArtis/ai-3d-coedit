# 다른 PC 실행·비밀정보·데이터 이전

작성: 2026-10-14. 이 문서는 안내이며 데이터 이전·비밀번호 변경·외부 공개는 아직 수행하지 않았다.
빠른 시작은 최상위 [START_HERE.md](../../START_HERE.md)를 따른다.

## Git에 있는 것과 없는 것

| 구분 | Git 포함 | 다른 PC에서 할 일 |
|---|---|---|
| 소스·설정 예시·테스트·작업 문서 | 포함 | feat/implementation 브랜치 clone |
| 자체 제작 테스트 FBX/GLB·검증 이미지/수치 | 포함 | 실제 학생 업로드와 구분 |
| node_modules·dist·Python 가상환경 | 제외 | npm ci, 빌드, Python 환경 재생성 |
| 모델 가중치·외부 모델 코드·KTX 도구·Blender 설치 파일 | .cache 아래 제외 | 다운로드하거나 허용된 파일만 별도 이전 |
| 업로드·생성 모델·제출 결과 | .data/objects 아래 제외 | 기존 작품을 유지할 경우 DB와 같은 시점으로 복사 |
| 계정·비밀번호 해시·수업·이력·대화 | PostgreSQL Docker 볼륨, Git 제외 | 필요할 때만 비공개 dump/복원 |
| 작업 큐·진행 상태 | Redis Docker 볼륨, Git 제외 | 완료 후 이전 권장. 진행 중 큐의 복원은 별도 검증 |
| 개인 환경 파일·키·인증서·백업 | .env/.env.*, .secrets, backups 및 키 파일 제외 | 안전한 경로로 전달하거나 새로 발급 |
| Ollama 모델 | 저장소 밖, 이 PC는 D:/AI/ollama_models | 새 PC에서 qwen3:4b 다운로드 또는 모델 저장소 별도 이전 |

Git 백업은 전체 PC/데이터 백업이 아니다. Git 제외 규칙은 이미 추적된 파일을 소급 제거하지 않으므로 커밋 전에도 검사한다.

## 현재 비밀정보 구조

- 기본 AI는 로컬 Ollama다. 기본 실행에 OpenAI/Anthropic 유료 API 키가 필요하지 않다.
- `infra/compose.yml`와 미리보기 코드에 있는 DB 자격정보는 공개된 개발용 기본값이다. 비밀키로 취급하거나 운영에 재사용하지 않는다.
- Redis는 현재 로컬 127.0.0.1:63799를 쓰며 기본 인증이 없다. DB 54329·Redis·Ollama 포트를 인터넷에 공개하지 않는다.
- 강사 비밀번호와 로그인 데이터는 Git이 아닌 DB에 저장된다. DB 백업도 민감정보이므로 공개 저장소·이슈·채팅에 올리지 않는다.
- `DATABASE_URL`은 서버 전용. `VITE_` 변수는 브라우저에 포함되므로 비밀번호/API 키를 넣지 않는다.
- 서버는 `.env`를 자동으로 읽도록 구성되어 있지 않다. PowerShell 환경변수를 프로세스 시작 전에 설정한다. 창마다 환경변수 적용 범위를 확인한다.
- 외부 터널을 나중에 사용하면 해당 인증 정보 역시 Git에 넣지 않는다. 이전 PC에서 발급한 브라우저 로그인 토큰을 복사하지 말고 다시 로그인한다.

## 새 PC의 로컬 실행

1. Git, Node 24.11 이상, Docker Desktop(Linux 컨테이너), Ollama를 준비한다.
2. 최상위 문서의 clone/npm ci/compose 명령을 실행한다. 포트 54329/63799 충돌을 먼저 확인한다.
3. `ollama pull qwen3:4b`를 실행하고 Ollama가 127.0.0.1:11434에서 동작하는지 확인한다.
4. 별도 터미널에서 서버·LLM·웹을 실행한다. 모든 명령의 작업 위치는 clone한 저장소 루트다.
5. 기본 도형 편집·로그인·AI 응답을 먼저 확인한다. 이미지/3D/캐릭터/VR 생성은 아래 의존물을 준비한 뒤 시험한다.

로컬 미리보기용 `npm run dev:server`는 익명 체험을 포함한다. 이것을 그대로 공개하지 않는다.
인증 서버는 `npx tsx apps/server/src/main.ts`이며 `DATABASE_URL`이 필수다. `LOCAL_PREVIEW`는 비우고, 외부 공개 시 `ALLOWED_ORIGIN`도 실제 HTTPS 주소로 설정한다.

## 운영용 DB 비밀번호를 설정할 때

개인용 Compose override를 `.secrets/compose.private.yml`에 두고 postgres의 POSTGRES_PASSWORD를 새 비밀번호로 덮어쓴다. 이 파일은 Git 제외다. 실행 시 기본 compose와 override를 모두 지정한다.

```powershell
docker compose -f infra/compose.yml -f .secrets/compose.private.yml up -d --wait
# 실제 값은 개인 환경에만 설정한다. URL 예약 문자는 인코딩해야 한다.
$env:DATABASE_URL = 'postgres://coedit:<URL_ENCODED_PRIVATE_PASSWORD>@127.0.0.1:54329/coedit'
npx tsx apps/server/src/main.ts
```

새 비밀번호 환경변수는 빈 DB 볼륨 초기화 때 적용된다. 기존 볼륨의 비밀번호는 override만 바꿔도 변경되지 않는다. 기존 데이터를 보존하고 DB 역할 비밀번호와 서버 연결 문자열을 함께 바꾸는 별도 절차가 필요하다. 이 문서에서는 기존 DB를 변경하거나 삭제하지 않는다.
현재 자동 테스트 다수는 개발용 기본 DB를 전제한다. 운영 DB를 테스트 대상으로 쓰지 말고 격리된 개발 환경을 사용한다.

## GPU·변환 기능 준비의 현재 한계

새 PC에서 전 기능을 한 번에 재현하는 설치 스크립트는 아직 없다. clone/npm ci만으로 생성까지 준비되었다고 판단하지 않는다.

- NVIDIA CUDA GPU와 Docker GPU 지원을 확인한다. 검증 PC와 다른 GPU의 VRAM 요구량·성능은 별도 측정한다.
- Python 3.11 가상환경을 새로 만든다. 기존 `.venv`는 다른 경로/PC로 복사하지 않는다.
- 현재 PC는 기존 CUDA Python 설치를 `--system-site-packages`로 참조했다. `docs/evidence/gpu-environment.json`은 실행 버전 기록이며 이식 가능한 완전한 lockfile은 아니다. 호환 CUDA PyTorch를 새 PC에 준비한 후 `workers/gpu/README.md`를 따른다.
- `python -m workers.gpu.prepare_vendor`: 고정 리비전의 TripoSG/MV-Adapter 코드와 프로젝트 호환 패치 준비.
- `python -m workers.gpu.prepare_models <model>`: sdxl, triposg, rmbg, mvadapter, sdxl-vae-fix를 개별 준비한다. 기본 경로는 `.cache/models/`다.
- **발견된 이전 준비 공백:** 현재 mvadapter 다운로드 목록은 image-to-multiview 파일만 포함하지만 text-geometry는 `mvadapter_tg2mv_sdxl.safetensors`도 요구한다. 새 PC 설치 시 같은 고정 리비전에서 이 파일을 별도 확보하거나 다운로드 도구를 보완·검증해야 한다.
- 텍스처 컨테이너: `docker build -f workers/gpu/Dockerfile.texture -t coedit-texture:research .`. 현재 `TORCH_CUDA_ARCH_LIST=12.0`이므로 다른 GPU에서는 해당 GPU 지원 아키텍처로 빌드 구성을 검토해야 한다. 그대로 된다고 보장하지 않는다.
- 캐릭터 컨테이너: `workers/characters/README.md`의 Blender 5.1.2 아카이브·SHA 검증과 빌드 절차를 따른다.
- 감량/VR의 KTX2 압축: 기본 `.cache/ktx/bin/toktx.exe` 또는 실제 설치 파일을 가리키는 `TOKTX_PATH`가 필요하다. CPU 워커 환경에도 적용한다.
- 서버/CPU/GPU 워커는 같은 `OBJECT_STORE_DIR`을 사용해야 한다. 기본값은 저장소 루트의 `.data/objects`다.
- 준비 후 `npm run dev:cpu`, `npm run dev:gpu`를 각각 실행하고 실제 1건 생성·승인·배치·캐릭터 변환으로 확인한다.
- RMBG/nvdiffrast 등 기존 연구용 라이선스 제한은 그대로 유지한다. `docs/licenses.md` 참고.

## 기존 계정·작품까지 옮길 때

안전한 기본 순서: 새 요청 중단 → 진행 작업 완료 확인 → 앱·워커 정상 종료 → DB dump + 오브젝트 파일 복사 → 새 PC 빈 환경에서 복원 → 검증.
원본은 검증이 끝날 때까지 보존한다. 진행 중 작업이 남아 있으면 임의로 큐를 지우지 말고 Redis AOF와 `.cache/jobs` 영수증까지 일관되게 이전하는 별도 절차를 정한다.

다음은 현재 기본 로컬 compose의 DB 백업 예시다. 데이터 변경은 멈춘 상태에서 수행한다. `docker cp`로 바이너리를 복사해 Windows PowerShell의 바이너리 리다이렉션 문제를 피한다.

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
docker compose -f infra/compose.yml exec -T postgres pg_dump -U coedit -d coedit -Fc -f /tmp/coedit-transfer.dump
# 직전 명령 성공을 확인한 후 진행
$coeditDbContainer = docker compose -f infra/compose.yml ps -q postgres
docker cp "${coeditDbContainer}:/tmp/coedit-transfer.dump" backups/coedit.dump
```

`backups/coedit.dump`와 `.data/objects`를 암호화된 이동식 저장장치 등 비공개 경로로 함께 전달한다. 실제 사용자 이름·대화·업로드가 포함될 수 있다. DB dump만 복원하면 모델 파일이 누락된다. 이 절차는 아직 실행하지 않았다.

새 PC에서는 **복원 대상이 새 빈 DB인지 먼저 확인**한다. 이미 쓰는 DB에 덮어쓰지 않는다. 앱이 테이블을 만들기 전에 복원한다.

```powershell
$coeditDbContainer = docker compose -f infra/compose.yml ps -q postgres
docker cp backups/coedit.dump "${coeditDbContainer}:/tmp/coedit-transfer.dump"
docker compose -f infra/compose.yml exec -T postgres pg_restore -U coedit -d coedit --no-owner --no-acl --exit-on-error /tmp/coedit-transfer.dump
```

복사한 objects를 새 PC `.data/objects`에 두고 서버를 실행한다. 로그인·수업 목록·작품 열기·생성 모델 다운로드·새 저장을 확인한 후 이전 완료를 판단한다. 임시 dump 정리는 복원 검증 뒤 대상 경로를 확인하고 진행한다.

## 후속 작업

1. 새 PC에서 쓸 목적을 구분한다: 원래 PC 서버에 브라우저 접속만 할 경우 위 모델/DB 설치는 불필요하다. 새 PC 자체를 서버로 바꿀 때만 전체 이전한다.
2. 먼저 로컬 편집·AI를 확인하고, GPU 의존물 설치/이전 공백을 해결한다.
3. 기존 자료가 필요하면 비공개 데이터 이전을 별도로 실행한다.
4. 외부 링크 공개는 `external-access-plan.md`의 인증 경계와 HTTPS/WSS 준비부터 진행한다.
5. 이번 Git 백업으로 외부 배포·자동 기동·데이터 이전이 완료된 것은 아니다.