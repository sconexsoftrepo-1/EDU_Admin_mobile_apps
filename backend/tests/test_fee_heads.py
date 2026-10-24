def test_custom_category_is_saved_and_billing_rules_stay_explicit(client, headers, app):
    response = client.post('/api/v1/workspace/resources/fee_heads', headers=headers,
        json={'values': dict(code='FH-SPORTS', name='Sports fee', collection_ownership='internal',
                             scholarship_eligible=False, category='other', category_label='  Sports  ')})
    assert response.status_code == 201, response.text
    assert response.json()['category_label'] == 'Sports'
    assert response.json()['category'] == 'other'
    saved = client.get('/api/v1/finance/fee-heads/FH-SPORTS', headers=headers)
    assert saved.status_code == 200
    assert saved.json()['category_label'] == 'Sports'
    from app.modules.master_data.enrollment.api import fee_lines
    with app.state.store.transaction() as data:
        data['records'].setdefault('fee_structures', {})['FS-SPORTS'] = dict(code='FS-SPORTS', program_code='P',
            academic_year_code='AY', semester_number=1, fee_head_code='FH-SPORTS', amount='100',
            due_date='2026-12-01', currency='INR')
    lines = fee_lines(app.state.store.snapshot(), 'P', 'AY', False, False)
    assert len(lines) == 1 and lines[0]['amount'] == '100.00'


def test_external_ownership_needs_an_organization_and_internal_clears_it(client, headers, app):
    values = dict(code='FH-BOARD', name='Board examination', collection_ownership='external',
                  scholarship_eligible=False, category='academic', category_label='Board fees')
    rejected = client.post('/api/v1/workspace/resources/fee_heads', headers=headers, json={'values': values})
    assert rejected.status_code == 422
    with app.state.store.transaction() as data:
        data['records'].setdefault('external_parties', {})['BOARD'] = dict(code='BOARD', name='Board',
            party_type='examination_board', is_active=True)
    values['external_party_code'] = 'BOARD'
    created = client.post('/api/v1/workspace/resources/fee_heads', headers=headers, json={'values': values})
    assert created.status_code == 201, created.text
    changed = client.patch('/api/v1/workspace/resources/fee_heads/FH-BOARD', headers=headers,
        json={'values': {'collection_ownership': 'internal'}})
    assert changed.status_code == 200, changed.text
    assert changed.json()['external_party_code'] is None


def test_blank_and_oversized_category_names_are_rejected(client, headers):
    values = dict(name='Activity fee', collection_ownership='internal', scholarship_eligible=False,
                  category='other')
    for name in ['   ', 'x' * 81]:
        response = client.post('/api/v1/workspace/resources/fee_heads', headers=headers,
                               json={'values': {**values, 'category_label': name}})
        assert response.status_code == 422
