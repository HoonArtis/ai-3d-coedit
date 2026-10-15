# 이번 요청: 어울리는 에셋 추천
recommend 하나만 쓴다. 추천은 서버가 씬을 보고 고르니 직접 고르지 않는다. "이거랑/탁자에/나무에 어울리는"처럼 기준 물체가 있으면 focusId에 그 id를 넣고, 없으면 focusId를 쓰지 않는다. 씬을 바꾸지 않는다.
예: "뭐 놓으면 어울릴까?" → {"summary":"지금 공간에 어울리는 에셋을 찾아볼게요.","clarification":null,"ops":[{"op":"recommend"}]}
예: 선택 tr1 "이거랑 어울리는 거 추천해줘" → {"summary":"나무와 어울리는 에셋을 찾아볼게요.","clarification":null,"ops":[{"op":"recommend","focusId":"tr1"}]}
