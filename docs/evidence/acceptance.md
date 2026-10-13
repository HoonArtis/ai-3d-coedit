# 수업 통합 검증 — 2026-10-14

실제30연결·6방·AI·GPU생성·승인 검증이 완료됐다. tools/acceptance-class.ts, class-session.json, .superpowers/sdd/PLAN/class-acceptance-final.log가 최종 증거다. 6방 AI편집, 실제SDXL이미지확인·RMBG·TripoSG형상·텍스처/프리셋·CPU감량·강사승인·명시적배치를 모두 통과했다. 전체생성큐1097.731초(약18.3분), 각 생성학생1회차감. 한 모델의 텍스처실패는 학생역할이 공개API로 wood프리셋을 직접 선택한 뒤 완료했으며 자동으로 숨기지 않았다. 제출 seq7을 서버재시작 뒤 동일하게 복구하고 두 실제소켓감상자가 포즈를 받았다. 성공 후 격리DB와 테스트자격증명 체크포인트를 정리했다.

HTTPS 재시작 검증: tools/acceptance-https.ts, https-vr.json, https-vr.png. 실제 PG저장→제출→CPU VR굽기→서버종료/재시작→동일환경조회→두 Chromium HTTPS/WSS 감상연결→합성포즈공유까지 통과했다. 자체서명 인증서는 테스트 context에서만 허용하고 OS 신뢰저장소는 수정하지 않았다. XR지원 플래그만 테스트에서 true로 지정했으며 실세션/헤드셋 입력은 사용자가 제외했다. 실제 포즈통신·파일조회·인증·저장·재시작은 mock이 아니다.

실패와 수정:
- 최초 HTTPS테스트2회는 tsx가 직렬화된 init함수 안에 __name helper를 넣어 XR지원 stub이 실행되지 않은 테스트환경 문제였다. 오류 계측과 공식 https://github.com/microsoft/playwright/issues/31569 및 https://github.com/privatenumber/tsx/issues/113 으로 동일원인을 확인했다. 명시적인 init script 문자열을 사용해 해결했다.
- 이후 HTTPS WebSocket이 대기한 원인은 진단proxy의 정규식이 sessionId query를 포함한 경로와 일치하지 않기 때문이었다. query 경계를 허용한 뒤 실제WSS2연결 통과. 브라우저종료 직후 proxy ECONNABORTED는 종료된socket쓰기로만 발생했고, 테스트contexts를 about:blank로 이동하여 정상leave 후 종료하도록 정리했다.

저장실패/깨진산출물/VR실패는 tests/integration/persistence, artifact-storage, vr-registration, vr-bake와 브라우저 vr.spec에서 거부/재시도·오류노출을 확인했다. 실패를 ready로 바꾸지 않는다. 별도 최종리뷰의 Important2건과 회귀 근거는 regression.md를 따른다. 판매 경로와 실기기 검증은 이번 범위에서 제외했다.

## 실제 수업 최초 실행의 텍스처 실패

첫6방 실행은 30명 편집/6방AI/6개 실제이미지·형상까지 통과하고5개 텍스처·승인·배치를 완료했다. 의자1개는 Open3D UVAtlasPartition code0x80004005로2회 실패하여 material_choice가 됐다. 첫 테스트 도구가 이 지원된 대체 상태를 fatal로 취급했으므로 전체 통과를 선언하지 않았다. 첫결과는 class-session-first-attempt.json 및 class-acceptance.log로 보존했다.

추측 수정을 중지하고 공식 https://github.com/huanngzh/MV-Adapter/issues/65 와 https://github.com/isl-org/Open3D/issues/7013, 고정된 mesh_process.py:uv_parameterize_uvatlas/process_raw를 조사했다. 전자는 같은공식pipeline에서 UVAtlas실패를 보고하며 후자는 비다양체 입력의 제약을 설명한다. 데이터마다 UVAtlas의 성공을 보장하는 근거가 없으므로 메쉬를 임의로 깎아 성공시키지 않는다. 기존 요구사항의 명시적 재질 프리셋 선택을 수업 테스트에서도 수행하도록 수정했다. 테스트는 실패원인·선택자·preset을 기록하고 추가차감 없이 실제CPU감량/승인/배치까지 확인한다. 이는 사용자에게 숨겨진 대체가 아니다.

재검증은 새30명/6방의 전체실제모델흐름을 다시 실행해 통과했다. 테스트 도구는 실패 시 체크포인트와 격리DB를 보존하여 추후 독립 GPU작업을 불필요하게 반복하지 않도록 했다. 추가 제출 단계에서 혼동한 Submission.id/VRRecord.snapshotId도 공개계약에 맞췄다.

## 실제 프로세스 재시작 추가 검증

HTTPS 최종 도구는 서버를 별도 Node프로세스로 실행하고 종료한 뒤 다른 PID로 띄운다. https-vr.json의 processIds 11648→43540(각 실행마다 달라짐), 동일snapshot환경/seq, 실제WSS2연결/포즈수신/페이지오류0을 확인했다. 단순 service객체 재생성과 구분했다. 최초 프로세스 버전은 초기 포즈수신5초 기대가 시간초과였고, 포즈진단 및10초준비대기 후 같은 테스트가 통과했다. 정상 지속전송은120ms이며 테스트 대기시간을 헤드셋 지연으로 해석하지 않는다.

## 최종 모듈·회귀 게이트

공통contracts/domain → server권한/저장/큐 → GPU·CPU adapter → 승인 library → web editor/VR 경계를 실제수업에서 통합 확인했다. UI와 LLM이 독자적으로 씬을 바꾸지 않고 모든배치는 공통명령으로 처리됐다. 198개 단위·통합, Python7개, 기존브라우저27개+추가 실제생성복원1개, build/typecheck/module 검사 PASS. 최종 코드리뷰 Critical0/Important2는 regression.md의 재현·수정으로 모두 해소했다. GPU 이미지6개가 job/version seed계약을 사용한 실측은 generation-seeds.json이다.

완료 범위는131개. 헤드셋 VR-03-01/02, PERF-02-03 및 판매 LIC-03-01/02/03의6개는 사용자승인 제외이며 완료로 합산하지 않는다. 기존 연구용 모델 제한과 실제기기 미확인 상태는 유지한다.
