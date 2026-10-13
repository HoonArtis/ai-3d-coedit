"""Validate the local execution ledger; does not execute product tests."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parent


def field(text, name):
    match = re.search(r"^- " + re.escape(name) + r": (.+)$", text, re.M)
    return match.group(1) if match else ""


def validate(root=ROOT):
    errors = []
    records = json.loads((root / "ticket-map.json").read_text(encoding="utf-8"))
    by_id = {record["id"]: record for record in records}
    if len(records) != len(by_id):
        errors.append("Duplicate ticket IDs")
    statuses = {}
    sections = (
        "## 검증 기준", "## 구현 → 검증 → 수정 → 재검증",
        "## 2회 실패 시 해결 사례 조사 (필수)",
        "## 모듈화 검증 (필수)", "## 실패·수정·조사 기록", "## 완료 증거",
    )
    plan = (root / "PLAN.md").read_text(encoding="utf-8")
    for ticket_id, record in by_id.items():
        path = root / "tickets" / f"{ticket_id}.md"
        if not path.is_file():
            errors.append(f"Missing ticket: {ticket_id}")
            continue
        text = path.read_text(encoding="utf-8")
        status = field(text, "상태").strip("`")
        statuses[ticket_id] = status
        if status not in {"todo", "doing", "review", "done", "blocked", "deferred"}:
            errors.append(f"Invalid status: {ticket_id}: {status}")
        for section in sections:
            if section not in text:
                errors.append(f"Missing section: {ticket_id}: {section}")
        actual_deps = re.findall(r"\[([A-Z]+-\d+-\d+)\]", field(text, "선행 티켓"))
        if actual_deps != record["deps"]:
            errors.append(f"Dependency index mismatch: {ticket_id}")
        for dep in record["deps"]:
            if dep not in by_id:
                errors.append(f"Unknown dependency: {ticket_id} -> {dep}")
        if f"tickets/{ticket_id}.md" not in plan:
            errors.append(f"Missing plan index: {ticket_id}")
        task_path = root / "tasks" / f"{record['task']}.md"
        if not task_path.is_file() or f"tickets/{ticket_id}.md" not in task_path.read_text(encoding="utf-8"):
            errors.append(f"Missing task index: {ticket_id}")
        parent = root / "tickets" / f"{record['parent']}.md"
        if not parent.is_file():
            errors.append(f"Missing split record: {ticket_id}")
        else:
            parent_text = parent.read_text(encoding="utf-8")
            if field(parent_text, "상태") != "`split`" or f"]({ticket_id}.md)" not in parent_text:
                errors.append(f"Invalid split mapping: {ticket_id}")
        if status == "done":
            if "- [ ]" in text:
                errors.append(f"Done with unchecked steps: {ticket_id}")
            evidence = text.split("## 완료 증거", 1)[-1]
            if re.search(r"미착수|미작성|미실행|미검증|미판정", evidence):
                errors.append(f"Done without evidence: {ticket_id}")
            if "| 미실행 |" in text:
                errors.append(f"Done without execution history: {ticket_id}")
    seen, active = set(), set()

    def visit(ticket_id):
        if ticket_id in active:
            errors.append(f"Dependency cycle at {ticket_id}")
            return
        if ticket_id in seen or ticket_id not in by_id:
            return
        active.add(ticket_id)
        for dep in by_id[ticket_id]["deps"]:
            visit(dep)
        active.remove(ticket_id)
        seen.add(ticket_id)

    for ticket_id in by_id:
        visit(ticket_id)
        if statuses.get(ticket_id) == "done":
            for dep in by_id[ticket_id]["deps"]:
                if statuses.get(dep) != "done" and not (statuses.get(dep) == "deferred" and "USER-2026-10-14-NO-HEADSET" in (root / "tickets" / f"{dep}.md").read_text(encoding="utf-8")):
                    errors.append(f"Done before dependency: {ticket_id} -> {dep}")
    parent_ids = {record["parent"] for record in records}
    actual_ids = {path.stem for path in (root / "tickets").glob("*.md")}
    if actual_ids != set(by_id) | parent_ids:
        errors.append("Unindexed or missing ticket documents")
    documents = [*root.rglob("*.md"), root.parent.parent / "CLAUDE.md"]
    for path in documents:
        text = path.read_text(encoding="utf-8")
        if "???" in text or "\ufffd" in text:
            errors.append(f"Possible encoding damage: {path.name}")
        for link in re.findall(r"\]\(([^)]+)\)", text):
            target = link.split("#", 1)[0]
            if target and not re.match(r"[a-z]+://", target) and not (path.parent / target).exists():
                errors.append(f"Broken link: {path.name} -> {target}")
    return errors, records, statuses


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    errors, records, statuses = validate()
    print(f"Executable tickets: {len(records)}; split records: {len({r['parent'] for r in records})}; tasks: {len({r['task'] for r in records})}")
    print(f"Done: {sum(s == 'done' for s in statuses.values())}/{len(records)}")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    ready = [r["id"] for r in records if statuses.get(r["id"]) == "todo" and all(statuses.get(d) == "done" for d in r["deps"])]
    print("PASS: links, IDs, dependencies, no cycles, split mapping, required workflow, completion evidence fields")
    print("Dependency-ready (external prerequisites still need checking): " + ", ".join(ready))
