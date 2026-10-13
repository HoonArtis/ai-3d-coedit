# 다른 PC에서 시작하기

**코드 백업 브랜치: `feat/implementation`.** 먼저 이 문서를 보고, 개발 작업 전에는 [CLAUDE.md](CLAUDE.md)를 읽는다.

## 접속만 할지, 서버를 옮길지

- **다른 PC에서 이용만 하기:** 이 PC가 서버를 계속 맡는다. 다른 PC에는 브라우저만 필요하다. 임시 Cloudflare 링크를 구성했다. 현재 주소와 계정은 서버 PC 바탕화면 `AI3D_외부테스트_접속정보.txt`에 있다. 프로세스 종료 후에는 새 링크가 필요하다.
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
## 이 PC의 임시 외부 서버

2570 포트의 인증 서버와 Cloudflare 터널을 실행했다. 기존 수업과 분리된 테스트 DB를 사용한다. 공개 가입은 차단했다. [검증 결과와 남은 시험](docs/evidence/external-access.md). 개인 설정은 `.secrets/external-test.json`에만 저장되어 다른 PC의 Git clone에는 포함되지 않는다.

## 지금 테스트하는 방법

1. 서버 PC 바탕화면 `AI3D_외부테스트_접속정보.txt`에서 현재 링크와 강사 계정을 확인한다. 이 파일은 Git 제외 개인 정보다.
2. 링크에서 **강사** 탭으로 로그인한다. **내 수업**에서 수업 이름·방 개수를 입력해 **수업 만들기**를 누른다.
3. 수업 카드의 **공통 수업 코드**와 접속 링크를 학생에게 전달한다. **학생 발급** 버튼은 기존 개인 ID 방식이 필요할 때만 사용한다.
4. 학생은 **수업 초대 코드 → 자리 선택하기 → 조/빈 학생 자리** 순서로 입장한다. 교사는 방 카드를 눌러 같은 편집실에 들어간다.
5. 학생은 같은 브라우저에서 **내 자리로 돌아가기**로 이어한다. 자리 선택은 실제 신원 인증이 아니며, 코드를 아는 사람은 빈 자리를 잡을 수 있다.

사용 중인 자리는 다른 학생에게 자동 반환되지 않는다. 다른 기기/브라우저 데이터 삭제 후 복귀는 아직 지원하지 않는다. 초기 공개 시험은 소수 인원으로 진행한다.
