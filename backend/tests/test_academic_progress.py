from datetime import datetime
from zoneinfo import ZoneInfo
import pytest
from app.core import academic_progress as progress
from app.core.curriculum_workspace import insert
from app.core.security import current_user
BASE='/api/v1/academics/semester-workspace'

@pytest.fixture
def academics(app,monkeypatch):
    monkeypatch.setattr(progress,'local_now',lambda:datetime(2026,10,31,10,30,tzinfo=ZoneInfo('Asia/Kolkata')))
    with app.state.store.transaction() as d:
        def put(t,c,**v):d['records'].setdefault(t,{})[c]={'code':c,**v}
        put('programs','P',name='BPC',course_level='intermediate',duration_semesters=4,department_code='D')
        put('academic_years','Y',name='2025–2027',program_code='P',batch_code='B',start_date='2025-06-01',end_date='2027-05-31')
        put('batches','B',program_code='P',academic_year_code='Y',entry_year=2025,graduation_year=2027)
        put('sections','A',batch_code='B',name='A')
        for n,(start,end) in enumerate([('2025-06-01','2025-11-30'),('2025-12-01','2026-05-31'),('2026-06-01','2026-11-30'),('2026-12-01','2027-05-31')],1):put('semesters',f'SEM{n}',academic_year_code='Y',semester_number=n,name=f'Semester {n}',start_date=start,end_date=end)
        for n in [1,2]:
            put('students',f'ST{n}',first_name=f'Student {n}',last_name='Demo',status='active')
            put('student_enrollments',f'EN{n}',student_code=f'ST{n}',section_code='A',status='active')
        put('student_parents','F',student_code='ST1',parent_code='PAR')
        put('teachers','T1',employee_code='E1');put('teachers','T2',employee_code='E2')
        put('employees','E1',first_name='Teacher 1',status='active');put('employees','E2',first_name='Teacher 2',status='active')
        insert(d,d['records']['programs']['P'],[{'semester_number':n,'subjects':[f'Botany {n}'],'labs':[]} for n in range(1,5)],False)
        subjects={s['semester_number']:s['subject_code'] for s in d['records']['curriculum_subjects'].values()}
        for n,t,time in [(1,'T2','09:00:00'),(2,'T1','10:00:00')]:
            put('subject_offerings',f'O{n}',subject_code=subjects[3],section_code='A',teacher_code=t)
            put('timetable_slots',f'SLOT{n}',offering_code=f'O{n}',weekday=6,start_time=time,end_time='10:00:00' if n==1 else '11:00:00',room_code='ROOM')
    return subjects


def payload(subject,marks='70',attempt=1):return {'program_code':'P','academic_year_code':'Y','semester_number':1,'subject_code':subject,'max_marks':'100','pass_marks':'40','assessed_on':'2025-11-29','attempt':attempt,'revision':0,'students':[{'student_code':'ST1','marks':marks}]}


def test_calendar_determines_active_semester_and_actual_timetable(client,headers,academics):
    data=client.get(BASE,headers=headers).json()
    assert data['batches'][0]['timeline']['current']==3
    assert data['batches'][0]['timeline']['state']=='ongoing'
    assert len(data['today_classes'])==2
    assert data['today_classes'][1]['state']=='ongoing'
    assert data['today_classes'][1]['period']==2
    assert data['totals']['backlog_students']==0
    assert data['batches'][0]['semesters'][0]['pending_students']==2


def test_final_fail_then_passing_reattempt_clears_backlog(client,headers,academics):
    body=payload(academics[1],'22')
    assert client.put(BASE+'/results',headers=headers,json=body).status_code==200
    data=client.get(BASE,headers=headers).json();term=data['batches'][0]['semesters'][0]
    assert term['backlog_students']==1 and term['all_clear']==0
    assert client.put(BASE+'/results',headers=headers,json=body).status_code==409
    assert client.put(BASE+'/results',headers=headers,json=payload(academics[1],'66',2)).status_code==200
    data=client.get(BASE,headers=headers).json();term=data['batches'][0]['semesters'][0]
    assert term['backlog_students']==0 and term['all_clear']==1 and term['pending_students']==1
    assert term['percentage']==66


def test_ungraded_published_result_is_pending_not_backlog(client,headers,academics):
    assert client.put(BASE+'/results',headers=headers,json=payload(academics[1],None)).status_code==200
    assert client.get(BASE,headers=headers).json()['totals']['backlog_students']==0


def test_parent_scope_does_not_expose_classmates(client,headers,academics,app):
    client.put(BASE+'/results',headers=headers,json=payload(academics[1],'60'))
    app.dependency_overrides[current_user]=lambda:{'code':'PARACC','person_type':'parent','person_code':'PAR'}
    data=client.get(BASE).json()
    assert data['totals']['students']==1
    assert {s['code'] for s in data['batches'][0]['students']}=={'ST1'}
    assert client.get(BASE,params={'student_code':'ST2'}).status_code==404
    assert client.put(BASE+'/results',json=payload(academics[1])).status_code==403
    app.dependency_overrides.clear()


def test_calendar_edit_checks_dates_and_revision(client,headers,academics):
    terms=[{'semester_number':i,'start_date':a,'end_date':b} for i,(a,b) in enumerate([('2025-06-01','2025-11-30'),('2025-12-01','2026-05-31'),('2026-06-01','2026-11-30'),('2026-12-01','2027-05-31')],1)]
    body={'program_code':'P','academic_year_code':'Y','revision':0,'semesters':terms}
    assert client.put(BASE+'/calendar',headers=headers,json=body).status_code==200
    assert client.put(BASE+'/calendar',headers=headers,json=body).status_code==409
    assert client.put(BASE+'/calendar',headers=headers,json={**body,'revision':1,'semesters':[terms[0],{**terms[1],'start_date':'2025-11-30'},*terms[2:]]}).status_code==422


def test_teacher_attendance_uses_actual_period_and_cannot_mark_another_subject(client,headers,academics,app):
    user={'code':'TACC','person_type':'employee','person_code':'E1','client':'teacher-mobile'}
    app.dependency_overrides[current_user]=lambda:user
    body={'program_code':'P','academic_year_code':'Y','section_code':'A','session_date':'2026-10-31','period':1,'revision':0,'marks':[{'student_code':'ST1','status':'present'}]}
    assert client.put('/api/v1/academics/attendance-workspace/register',json=body).status_code==422
    good=client.put('/api/v1/academics/attendance-workspace/register',json={**body,'period':2,'slot_code':'SLOT2'})
    assert good.status_code==200,good.text
    assert good.json()['subject_code']==academics[3] and good.json()['semester_number']==3
    app.dependency_overrides.clear()


def test_fee_reminders_use_balances_and_do_not_duplicate(app,academics):
    with app.state.store.transaction() as d:
        for t,c,v in [('accounts','SA',{'person_type':'student','person_code':'ST1','active':True}),('accounts','PA',{'person_type':'parent','person_code':'PAR','active':True})]:d[t][c]={'code':c,**v}
        d['records'].setdefault('fee_heads',{})['FH']={'code':'FH','name':'Tuition','collection_ownership':'internal','scholarship_eligible':True}
        d['records'].setdefault('fee_structures',{})['FS']={'code':'FS','fee_head_code':'FH','academic_year_code':'Y','semester_number':3,'fee_basis':'semester','amount':'1000','currency':'INR'}
        d['records'].setdefault('student_fee_charges',{})['CH']={'code':'CH','student_code':'ST1','fee_structure_code':'FS','amount':'1000','tax_amount':'0','due_date':'2026-11-05'}
        notices=progress.due_reminders(d)
        assert len(notices)==2
        assert progress.due_reminders(d)==[]
        assert all(d['records']['notifications'][n]['screen']=='fees' for n in notices)
        d['records'].setdefault('payments',{})['PAY']={'code':'PAY','student_code':'ST1','amount':'1000','status':'settled','paid_on':'2026-10-31','method':'cash','currency':'INR'}
        d['records'].setdefault('payment_allocations',{})['ALLOC']={'code':'ALLOC','payment_code':'PAY','charge_code':'CH','amount':'1000'}
        assert progress.fee_progress(d,{'ST1'})[0]['reminder_state']=='paid'
