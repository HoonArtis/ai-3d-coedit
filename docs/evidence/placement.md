# 결정적 자동 배치 검증 — 2026-10-13

AI-01-01~05: packages/placement 공개 API와 rooms/expand-command.ts.
npm test: 21파일 108개 PASS. placement.test.ts 5개, placement-room.test.ts 4개.
npm run check:modules PASS. placement는 contracts만 의존하며 three/DB/LLM을 가져오지 않는다.

- Bounds: bottom-centre origin, scale 후 XYZ Euler rotation의 8꼭짓점 world AABB.
  EPSILON=1e-6 이하 접촉은 충돌 아님. null 지형은 NO_GROUND.
  현재 템플릿은 y=0 평면이다. 메시의 정밀 삼각형 충돌로 표현하지 않는다.
- arrange_around: 입력 ID 순서와 radius로 xz 원을 만들고 +Z 정면을 중심에 맞춘다.
  동일 입력/출력, 탁자4의자, 공간 부족 전체 실패 검증.
- align_row: 입력 첫 객체 위치를 기준으로 지정 축/spacing 사용.
  distribute: 축 좌표(동률은 ID 코드포인트) 순서, 양 끝 사이 균등 분배.
  1개는 무변경, 0개는 INVALID_PLACEMENT, 겹침은 NO_SPACE.
- scatter: 명시 seed의 LCG, xz footprint가 min/max 영역 안에 있고 y는 허용 구간.
  객체별 최대128회 시도. 부족하면 결과 ops 전체를 반환하지 않는다.
- place_on: target AABB 상단 높이와 xz 지지 범위 사용.
  face_toward: atan2(dx,dz); 같은 xz 위치는 회전 유지. 없는 target은 NOT_FOUND.
- 권한/상한은 최종 domain 판정, chat 임시 잠금은 LockService가 원자 획득.
  planner에 별도 권한 정책을 복제하지 않는다.
- 서버 통합: 의자4개가 seq1회/undo1회, 타인 수정/200개 초과/부분 실패는 상태 불변.
  chat 요청 안에서 생성 후 변형도 임시 새ID 잠금으로 허용한다.

실패: 배치 모듈 부재 RED → 순수 함수 GREEN.
서버 자동op 미지원 RED → expansion + 원자 최종판정 GREEN.
한 요청 안의 생성→이동 RED → 생성할 ID만 missing lease 예약 허용 GREEN.
같은 수정·재검증 2회 연속 실패 없음, 사례 조사 분기 해당 없음.
실제 renderer의 나무 폭1.9m/화분높이1.08m에 맞춰 catalog bounds를 수정했다.

후속: 로컬 모델 선택/프롬프트/도구 호출은 AI-02, 큐와 대화/명령 접수는 AI-03.
이 문서의 알고리즘 검증을 실제 LLM 성공률로 해석하지 않는다.
