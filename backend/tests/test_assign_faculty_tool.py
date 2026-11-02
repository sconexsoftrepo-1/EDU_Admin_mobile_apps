import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from assign_faculty import apply, plan
from tests.test_lab_workspace import seed


def test_tool_fills_missing_faculty_once(app):
    seed(app)
    with app.state.store.transaction() as d:
        offerings = d['records']['subject_offerings']
        removed = {c: o for c, o in list(offerings.items())[:6]}
        for c in removed:
            del offerings[c]
        rows = plan(d)
        assert {(o['subject_code'], o['section_code']) for o in removed.values()} <= {(r['subject_code'], r['section_code']) for r in rows}
        assert all(r['teacher_code'] in d['records']['teachers'] for r in rows)
        apply(d, rows)
        assert plan(d) == []  # running again changes nothing
