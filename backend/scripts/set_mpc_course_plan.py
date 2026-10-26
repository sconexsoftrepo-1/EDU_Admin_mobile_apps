"""Convert the verified MPC admission schedule to a full-course plan, preserving charges.

Run from backend: .venv/bin/python -m scripts.set_mpc_course_plan --apply
Semester deadlines are deliberately left unscheduled until the campus confirms them.
"""
import argparse
import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from app.core.sqlserver import SqlServerStore
from app.core.storage import audit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    store = SqlServerStore()
    with store.transaction() as data:
        structures = data['records']['fee_structures']
        academic_year_code = ('INT-MPC-2026-2028'
                              if 'INT-MPC-2026-2028' in data['records']['academic_years']
                              else 'TEST')
        rows = [r for r in structures.values() if r['program_code'] == 'INT-MPC'
                and r['academic_year_code'] == academic_year_code]
        if len(rows) != 8 or sum((Decimal(r['amount']) for r in rows), Decimal(0)) != Decimal('67000'):
            raise RuntimeError('MPC schedule changed; expected exactly eight heads totaling 67000')
        if int(data['records']['programs']['INT-MPC']['duration_semesters']) != 4:
            raise RuntimeError('Course duration changed; review before applying')
        charges = [r for r in data['records']['student_fee_charges'].values()
                   if r['fee_structure_code'] in {f['code'] for f in rows}]
        if args.apply and any(r.get('fee_basis') != 'full_course' or r.get('currency') != 'INR' for r in rows):
            folder = Path('.migration-target')
            folder.mkdir(exist_ok=True)
            backup = folder / ('mpc-fees-before-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
            backup.write_text(json.dumps([dict(r) for r in rows], default=str, indent=2))
            backup.chmod(0o600)
            for row in rows:
                row.update(fee_basis='full_course', term_count=4,
                           term_due_dates=[None] * 4, currency='INR')
                audit(data, 'system:mpc-course-plan', 'edit', 'fee_structures', row['code'])
        print(json.dumps(dict(applied=args.apply, fee_heads=len(rows), course_total='67000.00',
            semester_total='16750.00', year_total='33500.00', preserved_student_charges=len(charges),
            due_dates='Not scheduled; campus confirmation required')))


if __name__ == '__main__':
    main()
