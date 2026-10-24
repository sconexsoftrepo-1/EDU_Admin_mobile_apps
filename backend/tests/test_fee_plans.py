from datetime import date
from decimal import Decimal

from app.core.fee_plans import semester_ledger, split_amount


def test_cent_exact_split():
    assert split_amount('10.01', 4) == [Decimal('2.51'), Decimal('2.50'), Decimal('2.50'), Decimal('2.50')]
    assert sum(split_amount('67000', 4)) == Decimal('67000')


def test_paid_and_overdue_are_attributed_to_earliest_semester():
    structures = {'F': dict(program_code='MPC', academic_year_code='AY', fee_basis='full_course',
        term_count=4, term_due_dates=['2026-01-01', '2026-06-01', None, '2027-06-01'])}
    charges = [dict(fee_structure_code='F', gross='67000', discount='0', scholarship='0', paid='20000')]
    plan = semester_ledger(charges, structures, date(2026, 10, 24))[0]
    assert [t['total'] for t in plan['terms']] == ['16750.00'] * 4
    assert [t['paid'] for t in plan['terms']] == ['16750.00', '3250.00', '0.00', '0.00']
    assert plan['years'][0]['balance'] == '13500.00'
    assert plan['years'][0]['overdue'] == '13500.00'
    assert plan['terms'][2]['status'] == 'Not scheduled'
    assert plan['terms'][2]['overdue'] == '0.00'


def test_concessions_refunds_and_legacy_are_not_double_counted():
    structures = {'F': dict(program_code='MPC', academic_year_code='AY', fee_basis='full_course', term_count=4),
                  'OLD': dict(fee_basis='annual')}
    charges = [dict(fee_structure_code='F', gross='100', discount='10', scholarship='10', paid='15'),
               dict(fee_structure_code='OLD', gross='500', paid='500')]
    plan = semester_ledger(charges, structures)[0]
    assert sum(Decimal(t['balance']) for t in plan['terms']) == Decimal('65')
    assert all(t['overdue'] == '0.00' for t in plan['terms'])
