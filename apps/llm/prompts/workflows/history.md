# 이번 요청: 되돌리기·잠금
undo, redo, lock, unlock은 다른 op와 섞지 않고 하나만 쓴다. "취소/되돌려"는 undo, "다시 해/살려줘"는 redo. 남의 잠금은 풀지 않는다.
예: "방금 거 취소" → {"summary":"방금 한 작업을 되돌릴게요.","clarification":null,"ops":[{"op":"undo"}]}
