# 방 서버 선정 — 2026-10-13

Colyseus core 0.18.18 / ws-transport 0.18.4 / sdk 0.18.5를 채택한다.
기존 잠정안이기 때문이 아니라 실제 5인+강사/동시 정원/위조 거부/재접속과 최신 씬 회복 실험이 통과했기 때문이다.

| 후보 | 서버 판정/정원 | 재접속 | 확장 | 판단 |
|---|---|---|---|---|
| Colyseus 0.18 | onAuth/onJoin/onMessage에서 판정. 학생 정원과 강사 예외는 자체 RoomService | onDrop/allowReconnection/onReconnect 실제 검증 | Redis presence/driver 기반 여러 프로세스. 로컬 다중 서버 부하 실측은 아직 아님 | 채택 |
| Socket.IO 4.8.4 | room 방송 제공, 명령/정원/서버 상태 관리는 자체 구현 필요 | connection state recovery 제공. 복구 실패 대비 snapshot 여전히 필요 | adapter로 서버 간 방송 | 가능하나 추가 생명주기 구현이 많음 |
| Yjs 13.6.33 | CRDT update 병합. y-websocket 인증/인가 가능. 우리 op·lease·원자 판정은 별도 계층 필요 | provider 재연결/sync 제공 | 공식 문서가 PubSub/sharding 방안을 제안 | 문서 편집 병합 이점보다 중앙 명령 판정과 중복되는 책임이 큼 |

Yjs가 권한 처리를 못한다고 단정하지 않는다. 이 제품의 명령 단위 원자성/lease/순번을
내장 해결한다는 근거는 없으므로 추가 구현 필요로 판단한다.
비선정 후보는 문서 비교만 했고 동일 성능 벤치마크를 수행한 것으로 표현하지 않는다.

공식 근거:
- https://docs.colyseus.io/room/lifecycle
- https://docs.colyseus.io/scalability
- https://socket.io/docs/v4/rooms/
- https://socket.io/docs/v4/connection-state-recovery
- https://docs.yjs.dev/ecosystem/connection-provider/y-websocket

실제 adapter: apps/server/src/rooms/colyseus-room.ts.
join = onAuth + onJoin, publish = event(snapshot/locks), reconnect = SDK token + allowReconnection(15초).
도메인/저장 계층에는 Colyseus 타입을 전달하지 않는다.
패키지 버전은 package-lock.json, 실험은 tests/tickets/room-01-02.test.ts.
