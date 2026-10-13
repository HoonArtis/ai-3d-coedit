# 개발 의존물 선정

확인일: 2026-10-13. Node 24.11.1 / npm 11.6.3. React 19 + R3F 9 호환은 https://r3f.docs.pmnd.rs/getting-started/installation 에서 확인했다. Vite 8 요구 조건은 https://vite.dev/guide/ 에서 확인했다.

| 패키지 | 버전 | npm 선언 라이선스 | 공식 배포 정보 |
|---|---|---|---|
| react | 19.3.0 | MIT | https://registry.npmjs.org/react/19.3.0 |
| react-dom | 19.3.0 | MIT | https://registry.npmjs.org/react-dom/19.3.0 |
| three | 0.186.1 | MIT | https://registry.npmjs.org/three/0.186.1 |
| @react-three/fiber | 9.8.1 | MIT | https://registry.npmjs.org/@react-three/fiber/9.8.1 |
| @react-three/drei | 10.7.9 | MIT | https://registry.npmjs.org/@react-three/drei/10.7.9 |
| typescript | 7.0.2 | Apache-2.0 | https://registry.npmjs.org/typescript/7.0.2 |
| vite | 8.3.4 | MIT | https://registry.npmjs.org/vite/8.3.4 |
| @vitejs/plugin-react | 6.1.2 | MIT | https://registry.npmjs.org/@vitejs/plugin-react/6.1.2 |
| vitest | 5.0.4 | MIT | https://registry.npmjs.org/vitest/5.0.4 |
| @playwright/test | 1.64.0 | Apache-2.0 | https://registry.npmjs.org/@playwright/test/1.64.0 |
| @types/react | 19.3.0 | MIT | https://registry.npmjs.org/@types/react/19.3.0 |
| @types/react-dom | 19.3.0 | MIT | https://registry.npmjs.org/@types/react-dom/19.3.0 |
| @types/three | 0.186.0 | MIT | https://registry.npmjs.org/@types/three/0.186.0 |
| @types/node | 26.6.5 | MIT | https://registry.npmjs.org/@types/node/26.6.5 |
| zod | 4.6.7 | MIT | https://registry.npmjs.org/zod/4.6.7 |
| colyseus | 0.18.9 | MIT | https://registry.npmjs.org/colyseus/0.18.9 |
| @colyseus/sdk | 0.18.5 | MIT | https://registry.npmjs.org/@colyseus/sdk/0.18.5 |
| pg | 8.23.1 | MIT | https://registry.npmjs.org/pg/8.23.1 |
| bullmq | 6.3.14 | MIT | https://registry.npmjs.org/bullmq/6.3.14 |
| ioredis | 6.0.0 | MIT | https://registry.npmjs.org/ioredis/6.0.0 |

React 원문: https://github.com/react/react/blob/main/LICENSE
R3F 원문: https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE
PostgreSQL 서비스: https://www.postgresql.org/about/licence/
Redis 서비스: https://github.com/redis/redis/blob/unstable/LICENSE.txt — 서비스 버전/배포 조건은 큐 도입 시 별도로 선정한다. Redis client의 MIT와 Redis 서버 조건을 혼동하지 않는다.

전이 의존물은 설치 후 lockfile 전체 패키지의 선언 라이선스와 실제 LICENSE 파일을 수집한다. 미확인은 자동 허용하지 않는다. 자동 다운로드가 있는 GPU/모델은 LIC-02에서 별도 검토한다. 최신 후보 중 실제 도입한 것만 package.json에 고정하며 서버 후보는 아직 확정하지 않았다.

규칙: 새 직접/전이 패키지 → 공식 배포 메타데이터/원문 → 고정 버전/lockfile → 설치 목록 대조 → licenses.md 갱신. 모듈 검사는 별도 라이브러리 없이 Node와 TypeScript parser로 구현한다.

## 실제 도입 조정

TypeScript는 7.0.2 후보 대신 **6.0.3**을 고정했다. 모듈 검사기의 compiler API는 공식 문서상 <7이다: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API . 전체 단위/타입/모듈 검사로 호환성을 확인했다. 원래 메타데이터는 후보 조사 기록이며 package-lock.json이 실제 버전 원본이다. 설치 후 [전이 의존물 목록](../evidence/installed-licenses.json)을 수집했으며 LICENSE 파일 없는 패키지는 원문 대조가 추가 필요하다.

## 방 서버 실험에서 추가 설치한 패키지
실제 고정: @colyseus/core 0.18.18, @colyseus/ws-transport 0.18.4,
@colyseus/sdk 0.18.5, tsx 4.23.15, @types/express 5.0.6.
설치 배포물의 선언과 LICENSE 수집은 installed-licenses.json을 참조한다.
전체 colyseus meta-package 대신 필요한 core/transport/sdk만 사용한다.
Colyseus는 현재 실험 adapter이며 최종 선정 티켓 완료와 구분한다.

이번 설치 후 lockfile 267개 항목을 재수집했다.
설치된 패키지 중 최상위 라이선스 파일이 없는 항목(판매 전 원문 대조 필요):
- node_modules/@better-auth/utils
- node_modules/@coedit/contracts
- node_modules/@coedit/domain
- node_modules/@coedit/server
- node_modules/@coedit/web
- node_modules/@esbuild/win32-x64
- node_modules/@mediapipe/tasks-vision
- node_modules/@msgpackr-extract/msgpackr-extract-win32-x64
- node_modules/@react-three/fiber
- node_modules/@rolldown/binding-win32-x64-msvc
- node_modules/draco3d
- node_modules/maath
- node_modules/stats-gl
