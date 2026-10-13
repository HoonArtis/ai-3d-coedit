# 계정·수업 입장 검증 — 2026-10-13

ACC-01-01~05. 구현: accounts/service.ts, password.ts, routes.ts,
002-accounts.sql, web/accounts/Login.tsx, Dashboard.tsx, contracts/accounts.ts.
비밀번호는 Node crypto.scrypt + 랜덤 salt로 저장하고 세션/학생 발급 ID는 SHA-256 digest만 저장한다.
학생 개인정보를 수집하지 않는다. 강사는 username/password 로컬 인증을 사용한다.
OAuth/이메일 인증 또는 상용 인증 서비스 연동으로 표현하지 않는다.

- accounts.test.ts: 강사 가입/로그인/로그아웃, 변조 역할 거부, 수업6방/학생30명,
  다른 조·수업·강사 접근 거부, 만료 세션 거부, 재로그인 actor 보존.
- 발급 중간 DB 실패: credential generator를 충돌시키면 실제 DB unique 오류가 발생하고 전체 발급이 rollback된다.
- accounts-http.test.ts: HTTP 가입/발급/로그인 → 실제 Colyseus 방 → 학생 에셋 저장 →
  새 로그인/재입장에서 동일 actor와 소유권 유지.
- accounts.spec.ts: 브라우저 가입/6방/30명/CSV/강사 입장, 학생의 잘못된 ID 오류와
  정상 입장/편집/재로그인 후 자기 에셋 선택. 모든 E2E 9개 통과.
- 단위·통합 99개, typecheck와 modules PASS.
- 화면 확인: teacher-dashboard.png. 후속 ACC-02의 실제 씬 썸네일/접속자/승인 배지는 아직 별도 작업이다.

실패 기록: API 미구현 404 RED → routes 연결 GREEN.
브라우저 로그인 페이지 부재 RED → Login/Dashboard/identity transport 연결 GREEN.
테스트 finally의 page.close 상태를 확인해 원래 오류를 가리지 않도록 수정.
DB 충돌 fixture RED → credential 생성 함수 주입 → 실제 unique 오류 및 rollback GREEN.
같은 수정의 2회 연속 실패 없음(사례 조사 분기 해당 없음).

모듈화: 저장/인증 서비스는 UI에 의존하지 않는다. 서버 세션 판정은 AccountService 하나에 모았고
소켓과 HTTP가 이를 소비한다. UI의 계정 DTO는 contracts 공개 타입으로 이동했다.
개발 서버는 PostgreSQL을 기본 연결하되 익명 로컬 체험 방은 메모리로 분리했다.
계정 방에서만 자동 저장 사용을 표시한다. 운영 main은 DATABASE_URL 없이 시작하지 않는다.
E2E는 개발 사용 중인 포트와 충돌하지 않도록 4174/2568을 사용한다.

근거: https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback
https://expressjs.com/en/5x/api/
