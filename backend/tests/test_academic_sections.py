import pytest
from tests.test_academic_progress import academics
from app.core.security import current_user
BASE='/api/v1/academics/batch-workspace'

@pytest.fixture
def roster(app,academics):
    with app.state.store.transaction() as d:
        d['records']['sections']['A'].update(semester_code='SEM3',capacity=50)
        d['records']['sections']['OLD']={'code':'OLD','batch_code':'B','semester_code':'SEM1','name':'Old'}
        for i in range(1,8):
            d['records']['students'][f'ST{i}']={'code':f'ST{i}','first_name':f'Student {i}','admission_number':f'ADM{i}','university_roll_number':f'UNI{10 if i==1 else i}','status':'active'}
            d['records']['student_enrollments'][f'EN{i}']={'code':f'EN{i}','student_code':f'ST{i}','section_code':'A','status':'active','roll_number':f'UNI{10 if i==1 else i}','enrolled_on':'2026-06-01'}
        d['records']['student_enrollments']['HIST']={'code':'HIST','student_code':'ST1','section_code':'OLD','status':'completed','roll_number':'UNI10','enrolled_on':'2025-06-01'}
    return {'semester_number':3,'sections':[{'code':'A','name':'A','capacity':50},{'name':'B','capacity':50}],'order_by':'university_roll_number','overrides':{}}


def test_balanced_natural_order_and_atomic_placement(client,app,headers,roster):
    before=app.state.store.snapshot()
    preview=client.post(BASE+'/Y/sections/preview',headers=headers,json=roster)
    assert preview.status_code==200,preview.text
    p=preview.json()
    assert [s['students'] for s in p['sections']]==[4,3]
    assert [s['university_roll_number'] for s in p['students']]==['UNI2','UNI3','UNI4','UNI5','UNI6','UNI7','UNI10']
    assert app.state.store.snapshot()==before
    saved=client.post(BASE+'/Y/sections/apply',headers=headers,json={**roster,'expected_revision':p['revision']})
    assert saved.status_code==200,saved.text
    d=app.state.store.snapshot(); active=[e for e in d['records']['student_enrollments'].values() if e['status']=='active']
    assert len(active)==7 and d['records']['student_enrollments']['HIST']==before['records']['student_enrollments']['HIST']
    assert d['records']['student_enrollments']['EN1']['status']=='transferred'
    assert len(d['documents']['section_placement_history'])==1
    # Parent sees only their own child's saved section and roll, including after reallocation.
    app.dependency_overrides[current_user]=lambda:{'code':'PARACC','person_type':'parent','person_code':'PAR'}
    response=client.get('/api/v1/academics/semester-workspace').json()
    current=[p for p in response['batches'][0]['placements'] if p['semester_number']==3]
    assert len(current)==1 and current[0]['student_code']=='ST1' and current[0]['section_name']=='B'
    app.dependency_overrides.clear()


def test_stale_preview_rejected_without_writes(client,app,headers,roster):
    p=client.post(BASE+'/Y/sections/preview',headers=headers,json=roster).json()
    with app.state.store.transaction() as d:d['records']['students']['ST1']['university_roll_number']='UNI99'
    before=app.state.store.snapshot()
    response=client.post(BASE+'/Y/sections/apply',headers=headers,json={**roster,'expected_revision':p['revision']})
    assert response.status_code==409 and app.state.store.snapshot()==before


def test_manual_override_capacity_and_section_scope(client,app,headers,roster):
    changed={**roster,'overrides':{'ST1':0}}
    p=client.post(BASE+'/Y/sections/preview',headers=headers,json=changed).json()
    assert next(s for s in p['students'] if s['student_code']=='ST1')['section_index']==0
    for invalid in [dict(roster,sections=[{'code':'OLD','name':'Invalid'}]),dict(roster,sections=[{'name':'A','capacity':1}]),dict(roster,overrides={'not-in-batch':0}),dict(roster,sections=[{'name':'A'},{'name':' a '}])]:
        assert client.post(BASE+'/Y/sections/preview',headers=headers,json=invalid).status_code in {409,422}


def test_unauthorized_and_duplicate_rolls(client,app,headers,roster):
    with app.state.store.transaction() as d:d['records']['students']['ST2']['university_roll_number']='UNI10'
    assert client.post(BASE+'/Y/sections/preview',headers=headers,json=roster).status_code==422
    assert client.post(BASE+'/Y/sections/preview',headers=headers,json={**roster,'order_by':'admission_number'}).status_code==200
    app.dependency_overrides[current_user]=lambda:{'code':'PARACC','person_type':'parent','person_code':'PAR'}
    assert client.get(BASE).status_code==403
    assert client.post(BASE+'/Y/sections/apply',json=roster).status_code==403
    app.dependency_overrides.clear()


def test_create_academic_batch_initializes_cohort_and_semesters(client,app,headers,academics):
    response=client.post(BASE,headers=headers,json={'program_code':'P','start_date':'2028-06-01','end_date':'2030-05-31'})
    assert response.status_code==201,response.text
    year=response.json(); d=app.state.store.snapshot()
    assert year['code']=='P-2028-2030' and year['batch_code'] in d['records']['batches']
    assert len([t for t in d['records']['semesters'].values() if t['academic_year_code']==year['code']])==4
    listing=client.get(BASE,headers=headers)
    assert listing.status_code==200 and any(b['code']==year['code'] and b['students']==0 for b in listing.json()['items'])
    assert client.post(BASE,headers=headers,json={'program_code':'P','start_date':'2028-06-01','end_date':'2030-05-31'}).status_code==409


def test_explicit_batch_link_prevents_same_dates_cohort_leak(client,app,headers,roster):
    with app.state.store.transaction() as d:
        d['records']['batches']['OTHER']={'code':'OTHER','program_code':'P','academic_year_code':'OTHER-YEAR','entry_year':2025,'graduation_year':2027,'name':'Other intake'}
        d['records']['sections']['OTHER-SEC']={'code':'OTHER-SEC','batch_code':'OTHER','semester_code':'SEM3','name':'Other section'}
        d['records']['students']['OUTSIDE']={'code':'OUTSIDE','first_name':'Other intake student','status':'active'}
        d['records']['student_enrollments']['OUTSIDE-EN']={'code':'OUTSIDE-EN','student_code':'OUTSIDE','section_code':'OTHER-SEC','roll_number':'OTHER001','status':'active'}
    response=client.post(BASE+'/Y/sections/preview',headers=headers,json=roster)
    assert response.status_code==200 and response.json()['total_students']==7
    assert 'OUTSIDE' not in {s['student_code'] for s in response.json()['students']}
    assert client.get(BASE,headers=headers).status_code==200
