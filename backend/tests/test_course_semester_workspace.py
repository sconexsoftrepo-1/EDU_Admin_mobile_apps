import pytest
from app.core.curriculum_workspace import insert, curriculum
from app.core.security import current_user

BASE='/api/v1/academics/course-curricula/INT-BPC'

@pytest.fixture
def plan(app):
    with app.state.store.transaction() as d:
        def put(table,code,**values): d['records'].setdefault(table,{})[code]={'code':code,**values}
        put('programs','INT-BPC',name='Intermediate BPC',department_code='D',duration_semesters=4,course_level='intermediate')
        put('programs','OTHER',name='Other',department_code='D',duration_semesters=4,course_level='intermediate')
        put('academic_years','Y',name='2026–2028',program_code='INT-BPC',batch_code='B',start_date='2026-06-01',end_date='2028-05-31')
        put('academic_years','OTHER-Y',name='Other',program_code='OTHER',batch_code='OTHER-B',start_date='2026-06-01',end_date='2028-05-31')
        put('batches','B',program_code='INT-BPC',entry_year=2026,graduation_year=2028)
        put('batches','OTHER-B',program_code='OTHER',entry_year=2026,graduation_year=2028)
        put('semesters','SEM1',academic_year_code='Y',semester_number=1)
        put('semesters','SEM2',academic_year_code='Y',semester_number=2)
        put('sections','A',name='A',batch_code='B',semester_code='SEM1')
        put('sections','SECOND',name='A2',batch_code='B',semester_code='SEM2')
        put('sections','OTHER-A',name='Other',batch_code='OTHER-B')
        put('students','ST',first_name='Ananya',status='active')
        put('student_enrollments','EN',student_code='ST',section_code='A',status='active')
        for n in range(1,4):
            put('employees',f'E{n}',first_name=f'Teacher {n}',status='inactive' if n==3 else 'active')
            put('teachers',f'T{n}',employee_code=f'E{n}')
        insert(d,d['records']['programs']['INT-BPC'],[{'semester_number':n,'subjects':[f'Botany {n}',f'Chemistry {n}'],'labs':[f'Botany lab {n}']} for n in range(1,5)],True)
        d.setdefault('documents',{}).setdefault('academic_batch_curricula',{})['Y']={**curriculum(d,'INT-BPC'),'academic_year_code':'Y'}
        row=curriculum(d,'INT-BPC')['items'][0]
    return row


def test_workspace_inline_edit_retains_subject_and_batch_identity(client,headers,plan,app):
    w=client.get(BASE+'/workspace',headers=headers).json()
    assert len(w['items'])==12 and w['can_edit'] and w['can_assign']
    assert len(w['teachers'])==2
    r=client.patch(BASE+'/subjects/'+plan['code'],headers=headers,json={'revision':1,'name':'Updated botany','subject_type':plan['subject_type'],'credits':'2'})
    assert r.status_code==200,r.text
    row=next(s for s in r.json()['items'] if s['code']==plan['code'])
    assert row['subject_code']==plan['subject_code'] and row['name']=='Updated botany'
    assert row['credits']=='2'
    snapshot=curriculum(app.state.store.snapshot(),'INT-BPC','Y')
    assert next(s for s in snapshot['items'] if s['subject_code']==plan['subject_code'])['name']=='Updated botany'
    assert client.patch(BASE+'/subjects/'+plan['code'],headers=headers,json={'revision':1,'name':'Stale','credits':'1'}).status_code==409


def test_add_subject_bounds_duplicates_and_revisions(client,headers,plan):
    body={'revision':1,'semester_number':1,'name':'Zoology','subject_type':'theory','credits':'3'}
    r=client.post(BASE+'/subjects',headers=headers,json=body)
    assert r.status_code==201,r.text
    assert len(r.json()['items'])==13
    assert client.post(BASE+'/subjects',headers=headers,json=body).status_code==409
    assert client.post(BASE+'/subjects',headers=headers,json={**body,'revision':2}).status_code==409
    assert client.post(BASE+'/subjects',headers=headers,json={**body,'revision':2,'semester_number':5}).status_code==422
    assert client.post(BASE+'/subjects',headers=headers,json={**body,'revision':2,'name':'  '}).status_code==422


def test_faculty_assign_reassign_enrollment_and_stale_protection(client,headers,plan,app):
    body={'revision':0,'academic_year_code':'Y','section_code':'A','subject_code':plan['subject_code'],'teacher_code':'T1'}
    r=client.put(BASE+'/faculty',headers=headers,json=body)
    assert r.status_code==200,r.text
    offering=r.json()['offerings'][0]
    assert offering['teacher_code']=='T1'
    assert len(app.state.store.snapshot()['records']['student_subjects'])==1
    assert client.put(BASE+'/faculty',headers=headers,json=body).status_code==409
    updated=client.put(BASE+'/faculty',headers=headers,json={**body,'revision':1,'expected_teacher_code':'T1','teacher_code':'T2'})
    assert updated.status_code==200,updated.text
    assert updated.json()['offerings'][0]['code']==offering['code']
    assert updated.json()['offerings'][0]['teacher_code']=='T2'
    assert len(app.state.store.snapshot()['records']['student_subjects'])==1


@pytest.mark.parametrize('change',[{'section_code':'OTHER-A'},{'section_code':'SECOND'},{'subject_code':'UNKNOWN'},{'teacher_code':'T3'},{'academic_year_code':'OTHER-Y'}])
def test_invalid_faculty_scopes_are_atomic(client,headers,plan,app,change):
    body={'revision':0,'academic_year_code':'Y','section_code':'A','subject_code':plan['subject_code'],'teacher_code':'T1',**change}
    r=client.put(BASE+'/faculty',headers=headers,json=body)
    assert r.status_code==422,r.text
    assert not app.state.store.snapshot()['records'].get('subject_offerings')


def test_course_reader_cannot_edit_or_allocate_and_family_cannot_open(client,headers,plan,app):
    with app.state.store.transaction() as d:
        d['roles']['ROOT']={'code':'ROOT','scope':'college','permissions':{'programs':['view']}}
    w=client.get(BASE+'/workspace',headers=headers).json()
    assert not w['can_edit'] and not w['can_assign'] and not w['teachers']
    assert client.post(BASE+'/subjects',headers=headers,json={'revision':1,'semester_number':1,'name':'New','credits':'1'}).status_code==403
    assert client.put(BASE+'/faculty',headers=headers,json={'revision':0,'academic_year_code':'Y','section_code':'A','subject_code':plan['subject_code'],'teacher_code':'T1'}).status_code==403
    app.dependency_overrides[current_user]=lambda:{'code':'ST','person_type':'student','person_code':'ST'}
    assert client.get(BASE+'/workspace').status_code==403
    app.dependency_overrides.clear()

def test_assigning_new_course_subject_extends_selected_batch_plan(client,headers,plan,app):
    created=client.post(BASE+'/subjects',headers=headers,json={'revision':1,'semester_number':1,'name':'New botany practical','subject_type':'practical','credits':'1'})
    assert created.status_code==201
    subject=next(s for s in created.json()['items'] if s['name']=='New botany practical')
    body={'revision':0,'academic_year_code':'Y','section_code':'A','subject_code':subject['subject_code'],'teacher_code':'T1'}
    assigned=client.put(BASE+'/faculty',headers=headers,json=body)
    assert assigned.status_code==200,assigned.text
    batch=curriculum(app.state.store.snapshot(),'INT-BPC','Y')
    assert any(s['subject_code']==subject['subject_code'] for s in batch['items'])


def test_single_section_batch_allocates_without_choosing_a_section(client,headers,plan,app):
    body={'revision':0,'academic_year_code':'Y','subject_code':plan['subject_code'],'teacher_code':'T1'}
    r=client.put(BASE+'/faculty',headers=headers,json=body)
    assert r.status_code==200,r.text
    assert [(o['section_code'],o['teacher_code']) for o in r.json()['offerings']]==[('A','T1')]


def test_batch_without_sections_gets_one_batch_wide_section(client,headers,plan,app):
    with app.state.store.transaction() as d:
        for code in ('A','SECOND'): del d['records']['sections'][code]
        del d['records']['student_enrollments']['EN']
    body={'revision':0,'academic_year_code':'Y','subject_code':plan['subject_code'],'teacher_code':'T1'}
    r=client.put(BASE+'/faculty',headers=headers,json=body)
    assert r.status_code==200,r.text
    created=[s for s in app.state.store.snapshot()['records']['sections'].values() if s['batch_code']=='B']
    assert len(created)==1 and not created[0].get('semester_code')
    w=r.json()
    assert [s['code'] for s in w['sections']]==[created[0]['code']]
    assert w['offerings'][0]['section_code']==created[0]['code']
    # Later semesters reuse the same batch-wide section instead of creating another.
    later=next(s for s in w['items'] if s['semester_number']==3)
    again=client.put(BASE+'/faculty',headers=headers,json={**body,'revision':1,'subject_code':later['subject_code']})
    assert again.status_code==200,again.text
    assert len([s for s in app.state.store.snapshot()['records']['sections'].values() if s['batch_code']=='B'])==1


def test_section_less_allocation_never_guesses_a_semester_or_bypasses_permissions(client,headers,plan,app):
    later=next(s for s in curriculum(app.state.store.snapshot(),'INT-BPC')['items'] if s['semester_number']==3)
    body={'revision':0,'academic_year_code':'Y','subject_code':later['subject_code'],'teacher_code':'T1'}
    r=client.put(BASE+'/faculty',headers=headers,json=body)
    assert r.status_code==422 and 'semester' in r.json()['detail']
    with app.state.store.transaction() as d:
        for code in ('A','SECOND'): del d['records']['sections'][code]
        d['roles']['ROOT']={'code':'ROOT','scope':'college','permissions':{'programs':['view'],'subject_offerings':['create','edit','view']}}
    r=client.put(BASE+'/faculty',headers=headers,json={**body,'subject_code':plan['subject_code']})
    assert r.status_code==403,r.text
    assert not [s for s in app.state.store.snapshot()['records']['sections'].values() if s['batch_code']=='B']
