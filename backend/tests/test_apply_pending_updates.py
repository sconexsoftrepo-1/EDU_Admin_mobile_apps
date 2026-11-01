import importlib.util
import shutil
import sys
from pathlib import Path

from tests.test_lab_workspace import seed

TOOLS = Path(__file__).resolve().parents[1] / 'tools'


def test_one_time_update_assigns_faculty_reports_and_deletes_itself(app, tmp_path, capsys):
    seed(app)
    with app.state.store.transaction() as d:
        offerings = d['records']['subject_offerings']
        for code in list(offerings)[:5]:
            del offerings[code]
    copy = tmp_path / 'apply_pending_updates.py'
    shutil.copy(TOOLS / 'apply_pending_updates.py', copy)
    sys.path.insert(0, str(TOOLS))
    spec = importlib.util.spec_from_file_location('apply_once', copy)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.HERE = copy
    module.store_for = lambda settings: app.state.store
    module.main()
    out = capsys.readouterr().out
    assert 'Faculty assigned to 5 subject(s)' in out
    assert 'Subjects still without faculty: 0' in out
    assert 'Demo data for' in out
    assert not copy.exists()
    assert (TOOLS / 'apply_pending_updates.py').exists()  # only the copy that ran is removed
