# 방 서버·저장 검증 — 2026-10-13

Windows / Node24.11 / PostgreSQL17 Docker(localhost:54329).
다른 프로젝트의 taskloop-db(5432)는 사용하거나 변경하지 않았다.
coedit 전용 compose volume을 사용한다.

## 검증별 증거
| 티켓 | 검증 |
|---|---|
| ROOM-01-01/03 | docs/decisions/room-server.md 공식 비교, 실제 고정 버전과 adapter 계약 |
| ROOM-01-02 | room-01-02.test.ts: 실제 socket 학생5+강사,6번째 거부,위조/다른방/재접속 토큰 거부,정상 재접속 |
| ROOM-02-01 | 동시6입장 중5명만 성공,viewer 합산,teacher 정원외 |
| ROOM-02-02 | core-01 계약의 actor/source 위조 거부 + RoomService 세션 기반 접수 |
| ROOM-02-03 | room-service 중복 requestId 동일결과/상이 payload 거부,DB unique와 복구 후 재전송 |
| ROOM-02-04 | 서버 seq만 증가,재접속 sync 최신객체 회복,실제 서버 restart seq/객체 회복 |
| ROOM-03-01/02 | room-service: 같은 actor의 다른 세션 경합,남의 unlock 불가,마지막 대상 실패 시 잠금 잔류 없음 |
| ROOM-03-03/04 | 단절/만료,옛세션 정리와 새잠금 분리,force_unlock 후 구토큰 거부,late heartbeat 회귀 |
| ROOM-04-01/02 | 실패한 다중 op의 state/seq/history 불변,다중 생성 단일undo,교사수정 후 전체undo 거부 |
| ROOM-04-03 | 연속undo/redo 체인,새 편집 시redo 정리,교사수정 후redo 거부 |
| ROOM-04-04 | 프리뷰100회 후seq1 유지,undo1회로 최초생성 제거,실제드래그 drop 후1명령 |
| ROOM-05-01 | persistence.test.ts 실제 migration,중복seq/requestId/FK 거부 |
| ROOM-05-02 | DB 실패 시live state 불변,성공한재시도만 반영,write 대기 중snapshot이 노출되지 않음 |
| ROOM-05-03 | 실제 socket서버 restart 복구,손상snapshot/누락command 복구 거부 |
| ROOM-05-04 | 별도 Node프로세스가COMMIT직후 응답없이 exit(24),동일요청재전송 후seq/명령1개 |
| ROOM-05-05 | submission.test.ts: 불변 객체저장소hash참조와 제출seq 보존,추가편집과 분리,upload실패시DB기록0 |

실행: npm test → 17 files / 94 tests PASS.
npm run typecheck / npm run check:modules PASS.
기즈모/5브라우저 E2E의 앞선 증거는 implementation-2026-10-13.md를 참조.

## 구현과 모듈 경계
RoomService는 동기 도메인 서비스, DurableRoom은 직렬 접수/후보 상태/내구커밋 순서,
RoomRepository는 저장 계약, PostgresRoomRepository는 SQL/transaction,
LocalObjectStore는 내용 hash 기반 불변 바이트 저장, SubmissionService는 제출 참조 저장을 맡는다.
성공 방송은 durable.submit이 resolve된 뒤에만 발생한다.
PG transaction은 동일 client의 BEGIN/COMMIT/ROLLBACK을 사용한다:
https://node-postgres.com/features/transactions .

로컬 ObjectStore는 실제 디스크 adapter다. 클라우드 S3를 연동/검증했다고 주장하지 않는다.
사용자 로그인/제출 UI와 VR 후속 등록은 담당 후속 티켓에서 연결한다.

## 실패/수정
1. persistence 스키마가 잘못된 seq를 즉시 거부해 손상 fixture 주입 실패.
   seq 제약을 약화하지 않고 scale 손상으로 회복 검증을 분리. 동일 테스트 GREEN.
2. 소켓 재시작 RED: 저장 adapter가 server생성에 주입되지 않아seq0.
   async onCreate에서load,command handler에서durable.commit 이후result/broadcast 연결. 동일 테스트 GREEN.
3. 기존 history의 undefined는 JSON에서키가사라짐. null로 직렬화하고 zod로복구.
   재시작 후undo가생성을삭제하는 통합 검증 GREEN.
연속 수정 실패 2회 없음. 선택적 사례조사 분기는 해당 없음.
