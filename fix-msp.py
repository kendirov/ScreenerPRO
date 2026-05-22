from pathlib import Path
WRONG = "motion" + "-safe-pills"
for rel in [
    "frontend/components/lab/currency-correlation/currency-correlation-workspace.tsx",
]:
    p = Path(rel)
    t = p.read_text(encoding="utf-8")
    if WRONG not in t:
        print(rel, "no match")
        continue
    p.write_text(t.replace(WRONG, "motion-safe-pills").replace("motion-safe-pills", "div"), encoding="utf-8")
    print("fixed", rel)
