# 다른 PC에서 시작하기

**코드 백업 브랜치: `feat/implementation`.** 먼저 이 문서를 보고, 개발 작업 전에는 [CLAUDE.md](CLAUDE.md)를 읽는다.

## 접속만 할지, 서버를 옮길지

- **다른 PC에서 이용만 하기:** 이 PC가 서버를 계속 맡는다. 다른 PC에는 브라우저만 필요하다. 외부 접속 링크는 아직 구성하지 않았다.
- **다른 PC 자체에서 서버 실행:** 아래 설치가 필요하다. Git에는 기존 계정·작품·AI 모델이 들어 있지 않다.

## 새 PC의 기본 실행

준비: Git, Node 24.11 이상, Docker Desktop(Linux 컨테이너), Ollama.

```powershell
git clone --branch feat/implementation https://github.com/b-hyoung/ai-3d-coedit.git
cd ai-3d-coedit
npm ci
docker compose -f infra/compose.yml up -d --wait
ollama pull qwen3:4b
```

이후 저장소 폴더에서 아래 명령을 **각각 별도 터미널**로 실행한다. Ollama도 실행 상태여야 한다.

```powershell
npm run dev:server
npm run dev:llm
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

접속: http://127.0.0.1:4173/ — 우선 기본 도형 편집·AI 응답을 확인한다.
**이것은 로컬 개발 실행이다. 외부에 그대로 공개하지 않는다.**

## 꼭 알아둘 것

- **비밀번호:** 저장소 DB 비밀번호는 로컬 개발용 공개 기본값이다. 외부 운영 전 새 비밀번호와 인증 설정이 필요하다.
- **개인 키:** 기본 로컬 AI에 유료 API 키는 필요 없다. 실제 비밀번호·토큰은 Git에 넣지 않는다. `VITE_` 변수에는 비밀정보를 넣지 않는다.
- **기존 작품:** 계정·작품을 옮기려면 PostgreSQL 백업과 `.data/objects`를 별도로 비공개 이전해야 한다. Git clone만으로 복구되지 않는다.
- **3D 생성:** NVIDIA/CUDA·Python 모델·텍스처 Docker·KTX 도구가 추가로 필요하다. 새 PC 자동 설치는 미완성이고 GPU별 검증이 필요하다. 준비 후 CPU/GPU 워커를 실행한다.
- **현재 완료 범위:** 기존 구현 131개 완료, 판매 경로·헤드셋 실기기 6개 제외. 외부 접속과 다른 PC 이전은 별도 후속 작업이다.

## 다음에 볼 문서

1. [비밀정보·모델 준비·기존 자료 이전 순서](docs/operations/migration-and-secrets.md)
2. [아침 외부 접속 작업: 예상 문제와 EXT-01~06](docs/operations/external-access-plan.md)
3. [기존 구현 작업 장부](docs/work/PLAN.md)

아침 재개 요청: **“START_HERE.md와 CLAUDE.md를 읽고, 새 PC 환경 확인부터 진행해. 외부 접속은 external-access-plan.md 순서로 검증하고, 실제로 확인하지 않은 결과는 통과로 쓰지 마.”**