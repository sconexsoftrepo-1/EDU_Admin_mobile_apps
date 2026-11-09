import re

from app.core.resources import code_prefix
from app.core.storage import new_code, next_code


def test_generated_codes_are_short_and_sequential():
    assert re.fullmatch(r"NOTICE-[0-9A-Z]{12}", new_code("NOTICE"))
    assert len({new_code("X") for _ in range(2000)}) == 2000
    rows = {"STU-4a5bf6c7fbd44052b3149ce4bdc72e7a": {}, "D26-ST48": {}, "STU-0007": {}, "STU-0009": {}}
    assert next_code(rows, "STU") == "STU-0010"
    assert next_code({}, "PAR") == "PAR-0001"
    assert (code_prefix("students"), code_prefix("academic_years"), code_prefix("student_fee_charges")) == \
        ("STU", "AY", "CHG")
