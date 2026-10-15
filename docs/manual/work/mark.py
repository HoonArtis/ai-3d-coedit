"""티켓 상태 변경과 실행 기록 추가. 사용: py mark.py M0-01 done "기록 문장" [산출물경로 ...]"""
import re, sys, pathlib, datetime
ROOT = pathlib.Path(__file__).parent
tid, status, note, *media = sys.argv[1:]
p = ROOT / "tickets" / f"{tid}.md"
text = p.read_text(encoding="utf-8")
text = re.sub(r"^- 상태: `\w+`", f"- 상태: `{status}`", text, count=1, flags=re.M)
text = text.replace("## 실행 기록\n\n(아직 없음)\n", "## 실행 기록\n")
stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
entry = f"\n- {stamp} `{status}` — {note}" + "".join(f"\n  - 산출물: `{m}`" for m in media)
p.write_text(text.rstrip() + "\n" + entry + "\n", encoding="utf-8")
print(tid, status)
