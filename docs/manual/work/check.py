"""설명서 장부 상태 검사: 진행률, 선행 누락, 다음 실행 가능 티켓 출력."""
import json, re, pathlib, sys
ROOT = pathlib.Path(__file__).parent
spec = json.loads((ROOT / "tickets.json").read_text(encoding="utf-8"))
tickets = {k["id"]: k for t in spec["tasks"] for k in t["tickets"]}
state, errors = {}, []
for tid in tickets:
    p = ROOT / "tickets" / f"{tid}.md"
    if not p.exists():
        errors.append(f"{tid}: 티켓 파일 없음 (build_ledger.py 실행)"); continue
    m = re.search(r"^- 상태: `(\w+)`", p.read_text(encoding="utf-8"), re.M)
    state[tid] = m.group(1) if m else "?"
    if state[tid] == "done" and "(아직 없음)" in p.read_text(encoding="utf-8"):
        errors.append(f"{tid}: done인데 실행 기록 없음")
for tid, k in tickets.items():
    for d in k["deps"]:
        if d not in tickets: errors.append(f"{tid}: 없는 선행 {d}")
        elif state.get(tid) == "done" and state.get(d) != "done" and not (tid.startswith("M9-") and state.get(d) == "blocked"): errors.append(f"{tid}: 선행 {d} 미완료인데 done")
done = sum(1 for s in state.values() if s == "done")
print(f"진행: {done}/{len(tickets)} done")
for s in ("doing", "blocked"):
    ids = [t for t, v in state.items() if v == s]
    if ids: print(f"{s}: {', '.join(ids)}")
ready = [t for t, k in tickets.items() if state.get(t) == "todo" and all(state.get(d) == "done" or (t.startswith("M9-") and state.get(d) == "blocked") for d in k["deps"])]
print("다음 실행 가능:", ", ".join(ready) or "없음")
for e in errors: print("오류:", e)
sys.exit(1 if errors else 0)
