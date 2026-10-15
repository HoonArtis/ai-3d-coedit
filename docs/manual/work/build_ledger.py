"""tickets.json -> PLAN.md / tasks/*.md / tickets/*.md 생성. 이미 있는 티켓 파일의 상태·기록은 보존한다."""
import json, re, pathlib
ROOT = pathlib.Path(__file__).parent
spec = json.loads((ROOT / "tickets.json").read_text(encoding="utf-8"))
(ROOT / "tasks").mkdir(exist_ok=True)
(ROOT / "tickets").mkdir(exist_ok=True)

def keep(path, marker):
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8")
    i = text.find(marker)
    return text[i:] if i >= 0 else None

plan = [f"# 기능 설명서 제작 플랜 — {spec['plan']}", "",
        "**목표:** 서버를 켜고 강사·학생 2명이 실제로 쓰는 현장을 촬영해, 기능별(메인·챗봇·AI 생성·강사·VR)로 스샷 + 확대 + 빨간 표시 + 짧은 영상으로 설명하는 단일 HTML 웹문서를 만든다.", "",
        "**산출물:** `docs/manual/guide.html`(단일 문서) + `docs/manual/media/`(스샷·크롭·영상). 촬영 스크립트는 `docs/manual/capture/`.", "",
        "**규칙:** 실제로 찍지 못한 화면은 만들어 넣지 않는다. GPU·헤드셋처럼 대체한 부분은 문서에 대체 사실을 적는다. 기본 데이터(기존 수업·계정)는 건드리지 않고 설명서 전용 강사 계정만 쓴다.", "",
        f"**문체:** {spec['style']}", "", f"**시연 상태 계약:** {spec['state_contract']}", "", f"**단일 HTML 기준:** {spec['single_html']}", "", f"**검토 모델:** {spec['review_model']}", "",
        "루프 실행 방법: [LOOP.md](LOOP.md) · 상태 검사: `py docs/manual/work/check.py`", "",
        "| 태스크 | 목표 | 티켓 |", "|---|---|---|"]
for t in spec["tasks"]:
    plan.append(f"| [{t['id']} {t['title']}](tasks/{t['id']}.md) | {t['goal']} | {', '.join(k['id'] for k in t['tickets'])} |")
(ROOT / "PLAN.md").write_text("\n".join(plan) + "\n", encoding="utf-8")

for t in spec["tasks"]:
    lines = [f"# {t['id']} — {t['title']}", "", f"상위: [{spec['plan']}](../PLAN.md)", "", f"**목표:** {t['goal']}", "",
             "| 티켓 | 결과 | 선행 |", "|---|---|---|"]
    for k in t["tickets"]:
        lines.append(f"| [{k['id']}](../tickets/{k['id']}.md) {k['title']} | {k['result']} | {', '.join(k['deps']) or '-'} |")
    lines += ["", "태스크 완료 게이트: 모든 티켓 `done` + 산출물을 실제 화면으로 다시 열어 확인."]
    (ROOT / "tasks" / f"{t['id']}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    for k in t["tickets"]:
        p = ROOT / "tickets" / f"{k['id']}.md"
        old = p.read_text(encoding="utf-8") if p.exists() else ""
        status = re.search(r"^- 상태: `(\w+)`", old, re.M)
        record = keep(p, "## 실행 기록")
        body = [f"# {k['id']} — {k['title']}", "",
                f"- 상위 태스크: [{t['id']}](../tasks/{t['id']}.md)",
                f"- 상태: `{status.group(1) if status else 'todo'}`",
                f"- 선행: {', '.join(k['deps']) or '없음'}", "",
                "## 결과", "", k["result"], "",
                "## 완료 확인", "", k["verify"], "",
                "## 절차", "",
                "1. 선행 산출물을 확인한다. 2. 촬영/제작한다. 3. 결과 파일을 직접 열어 눈으로 확인한다(빨간 표시 위치·글자 가독성·영상 재생).",
                "4. 틀리면 고쳐 같은 조건으로 다시 확인한다. 같은 문제 2회 실패 시 원인 조사 후 기록. 5. 산출물 경로와 확인 결과를 아래에 적고 `done`.", "",
                record or "## 실행 기록\n\n(아직 없음)\n"]
        p.write_text("\n".join(body).rstrip() + "\n", encoding="utf-8")
ids={k["id"] for t in spec["tasks"] for k in t["tickets"]}
for f in (ROOT/"tickets").glob("*.md"):
    if f.stem not in ids: f.unlink(); print("removed", f.stem)
print("ledger built", len(ids))
