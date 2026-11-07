"""Accounting parity and bounded source scans for the dashboard ledger optimization."""
from app.modules.finance.transactions.api import build_ledger_index, calculate_ledger


class CountedRows(dict):
    scans = 0
    def values(self):
        self.scans += 1
        return super().values()


def fixture_data(students=60, charges_each=4):
    r = {t: CountedRows() for t in ('students','student_fee_charges','fee_adjustments','charge_scholarship_allocations','payment_allocations','refund_allocations')}
    r['fee_structures'] = {'FS': {'code':'FS','fee_head_code':'H','currency':'INR'}}
    r['fee_heads'] = {'H': {'code':'H','name':'Tuition','collection_ownership':'internal'}}
    for n in range(students):
        student = f'S{n}';r['students'][student]={'code':student}
        for j in range(charges_each):
            code = f'C{n}-{j}'
            r['student_fee_charges'][code]={'code':code,'student_code':student,'fee_structure_code':'FS','amount':'1000.25','tax_amount':'12.50','due_date':'2026-01-01'}
            for table,value in [('fee_adjustments','20.05'),('charge_scholarship_allocations','30.10'),('payment_allocations','400.20'),('refund_allocations','10.15')]:
                r[table][code]={'code':code,'charge_code':code,'amount':value}
    return {'records':r}


def test_index_preserves_every_ledger_value_and_reads_sources_once():
    data = fixture_data()
    expected = {s:calculate_ledger(data,s) for s in data['records']['students']}
    sources = [rows for table,rows in data['records'].items() if table not in {'students','fee_heads','fee_structures'}]
    for rows in sources: rows.scans=0
    index = build_ledger_index(data)
    actual = {s:calculate_ledger(data,s,index=index) for s in data['records']['students']}
    assert actual == expected
    assert all(rows.scans==1 for rows in sources)
