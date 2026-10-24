"""Full-course schedules, with cent-exact semester attribution of existing charges."""
from datetime import date
from decimal import Decimal


def split_amount(value, count):
    cents = int(Decimal(str(value)).quantize(Decimal('.01')) * 100)
    base, remainder = divmod(cents, count)
    return [Decimal(base + (i < remainder)) / 100 for i in range(count)]


def semester_ledger(charges, structures, today=None):
    """Attribute net head balances to earliest semesters; retain real payment allocations.

    Missing semester dates remain unscheduled and never count as overdue. Course
    plans are grouped separately so different admissions cannot be merged.
    """
    today = today or date.today()
    groups = {}
    for charge in charges:
        structure = structures[charge['fee_structure_code']]
        if structure.get('fee_basis') != 'full_course':
            continue
        count = int(structure['term_count'])
        key = (structure['program_code'], structure['academic_year_code'], count)
        dates = structure.get('term_due_dates') or [None] * count
        if key not in groups:
            groups[key] = [dict(semester=i + 1, year=i // 2 + 1,
                due_date=dates[i] if i < len(dates) else None,
                total=Decimal(0), paid=Decimal(0), balance=Decimal(0), heads=[]) for i in range(count)]
        net = Decimal(charge['gross']) - Decimal(charge['discount']) - Decimal(charge['scholarship'])
        remaining_paid = Decimal(charge['paid'])
        for term, amount in zip(groups[key], split_amount(net, count)):
            paid = min(max(remaining_paid, Decimal(0)), max(amount, Decimal(0)))
            remaining_paid -= paid
            term['total'] += amount
            term['paid'] += paid
            term['balance'] += amount - paid
            term['heads'].append(dict(name=charge.get('fee_head', structure.get('fee_head_code', 'Fee')),
                total=f'{amount:.2f}', paid=f'{paid:.2f}', balance=f'{amount - paid:.2f}'))
    plans = []
    for (program, academic_year, _), terms in groups.items():
        years = {}
        for term in terms:
            due = date.fromisoformat(str(term['due_date'])[:10]) if term['due_date'] else None
            term['overdue'] = max(term['balance'], Decimal(0)) if due and due < today else Decimal(0)
            term['status'] = ('Paid' if term['balance'] <= 0 else 'Not scheduled' if not due
                              else 'Overdue' if due < today else 'Upcoming')
            year = years.setdefault(term['year'], dict(year=term['year'], total=Decimal(0), paid=Decimal(0), balance=Decimal(0), overdue=Decimal(0)))
            for field in ('total', 'paid', 'balance', 'overdue'):
                year[field] += term[field]
        def serialize(row):
            return {k: str(v.quantize(Decimal('.01'))) if isinstance(v, Decimal) else v for k, v in row.items()}
        plans.append(dict(program_code=program, academic_year_code=academic_year,
            terms=[serialize(t) for t in terms], years=[serialize(y) for y in years.values()]))
    return plans
