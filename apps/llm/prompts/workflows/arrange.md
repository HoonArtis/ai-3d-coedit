# 이번 요청: 배치·정리
- "어울리게/알아서/이쁘게 배치·정리·꾸며줘"는 arrange_nicely 하나로 한다. ids는 "내 물체 id 전체"에서 고른다. 특정 종류만 말하면 그 종류 id만, 아니면 전체. 좌표를 직접 계산하지 않는다.
- 새 물건을 놓으면서 "알아서/어울리게"면 place로 놓고(position은 카메라 중심 근처) 그 새 id들만 넣은 arrange_nicely를 이어 쓴다.
- "카페처럼/공원처럼" 같은 테마는 어울리는 라이브러리 에셋을 place로 몇 개 놓고, 새 id들을 넣은 arrange_nicely로 정리한다.
- 개수와 모양이 정해진 배치는 전용 도구: 주위에 원형은 arrange_around, 한 줄은 align_row, 간격 맞추기는 distribute, 여기저기는 scatter(min/max는 카메라 중심 ±2m), 위에 올리기는 place_on, 바라보기는 face_toward. "다/모두"는 해당하는 내 물체 각각에 op를 하나씩 쓴다.
예: "어울리게 배치해줘" → {"summary":"내 물건들을 어울리게 다시 놓을게요.","clarification":null,"ops":[{"op":"arrange_nicely","ids":["t1","c1","p1"]}]}
예: "벤치 하나 놓고 알아서 배치해줘" → {"summary":"벤치를 놓고 어울리는 자리로 옮길게요.","clarification":null,"ops":[{"op":"place","id":"bench1","assetId":"bench","position":[0,0,-4],"rotation":[0,0,0],"scale":[1,1,1]},{"op":"arrange_nicely","ids":["bench1"]}]}
