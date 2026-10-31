from datetime import datetime,timedelta,timezone
import pytest
from app.core.security import current_user
from app.core.curriculum_workspace import insert,seed_missing
BASE='/api/v1/academics/assessment-workspace'

@pytest.fixture
def cohort(app):
    future=(datetime.now(timezone.utc)+timedelta(days=2)).isoformat()
    with app.state.store.transaction() as d:
        def put(t,c,**v): d['records'].setdefault(t,{})[c]={'code':c,**v}
        put('programs','P',name='Computer applications',course_level='degree',department_code='D',duration_semesters=2)
        put('academic_years','Y',name='Batch',program_code='P',start_date='2020-01-01',end_date='2040-12-31',batch_code='B')
        put('batches','B',program_code='P',entry_year=2020,graduation_year=2040)
        put('sections','S',name='A',batch_code='B')
        put('teachers','T',employee_code='E')
        for s in ['ST1','ST2']:
            put('students',s,first_name=s,status='active')
            put('student_enrollments','EN'+s,student_code=s,section_code='S',status='active')
        put('student_parents','L',student_code='ST1',parent_code='PAR')
        d['accounts']['STUDENT']={'code':'STUDENT','active':True,'person_type':'student','person_code':'ST1'}
        d['accounts']['PARENT']={'code':'PARENT','active':True,'person_type':'parent','person_code':'PAR'}
        insert(d,d['records']['programs']['P'],[{'semester_number':1,'subjects':['Programming'],'labs':['Programming lab']},{'semester_number':2,'subjects':['Databases'],'labs':['Database lab']}],True)
        subject=next(r['subject_code'] for r in d['records']['curriculum_subjects'].values() if r['semester_number']==1)
        put('subject_offerings','O',teacher_code='T',subject_code=subject,section_code='S')
    return {'title':'Programming test','course_level':'degree','program_code':'P','academic_year_code':'Y','teacher_code':'T','subject_code':subject,'semester_number':1,'scheduled_at':future,'max_marks':'50','status':'published'}

def test_publish_transition_grade_and_family_privacy(client,headers,cohort,app):
    result=client.post(BASE,headers=headers,json=cohort); assert result.status_code==201,result.text
    code=result.json()['code']; assert result.json()['counts']['assigned']==2
    assert len(app.state.store.snapshot()['records']['notifications'])==2
    assert client.put(BASE+'/'+code+'/marks',headers=headers,json={'revision':1,'students':[{'student_code':'ST1','marks':'40'}]}).status_code==409
    with app.state.store.transaction() as d: d['documents']['assessments'][code]['scheduled_at']=(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat()
    graded=client.put(BASE+'/'+code+'/marks',headers=headers,json={'revision':1,'students':[{'student_code':'ST1','marks':'40'},{'student_code':'ST2','absent':True}]})
    assert graded.status_code==200,graded.text
    assert client.get(BASE,headers=headers).json()['performance']['percentage']==40
    assert client.put(BASE+'/'+code+'/marks',headers=headers,json={'revision':1,'students':[{'student_code':'ST1','marks':'41'}]}).status_code==409
    app.dependency_overrides[current_user]=lambda:{'code':'PARENT','person_type':'parent','person_code':'PAR'}
    own=client.get(BASE+'/'+code).json(); assert set(own['marks'])=={'ST1'}; assert own['can_grade'] is False
    assert client.get(BASE+'/'+code,params={'student_code':'ST2'}).status_code==404
    assert client.get(BASE+'/options').status_code==403
    app.dependency_overrides.clear()

def test_drafts_are_private_and_publish_once(client,headers,cohort,app):
    draft=client.post(BASE,headers=headers,json={**cohort,'status':'draft'}).json()
    assert draft['bucket']=='draft'
    assert not app.state.store.snapshot()['records'].get('notifications')
    app.dependency_overrides[current_user]=lambda:{'code':'STUDENT','person_type':'student','person_code':'ST1'}
    assert client.get(BASE).json()['items']==[]
    assert client.get(BASE+'/'+draft['code']).status_code==404
    app.dependency_overrides.clear()
    published=client.put(BASE+'/'+draft['code'],headers=headers,json={**cohort,'revision':1}); assert published.status_code==200,published.text
    assert client.put(BASE+'/'+draft['code'],headers=headers,json={**cohort,'revision':2}).status_code==409

@pytest.mark.parametrize('change',[{'subject_code':'OTHER'},{'semester_number':2},{'scheduled_at':'2050-01-01T10:00:00Z'},{'course_level':'intermediate'},{'scheduled_at':'2020-01-01T10:00:00Z'}])
def test_invalid_publish_is_atomic(client,headers,cohort,change,app):
    assert client.post(BASE,headers=headers,json={**cohort,**change}).status_code==422
    assert not app.state.store.snapshot()['documents'].get('assessments')

def test_curriculum_revision_and_idempotent_seed(client,headers,cohort,app):
    path='/api/v1/academics/course-curricula/P'
    result=client.get(path,headers=headers).json(); assert len(result['items'])==4
    body={'revision':1,'semesters':[{'semester_number':i,'subjects':[f'Subject {i}'],'labs':[f'Lab {i}']} for i in [1,2]]}
    assert client.put(path,headers=headers,json=body).status_code==200
    assert client.put(path,headers=headers,json=body).status_code==409
    with app.state.store.transaction() as d: assert seed_missing(d)==[]

def test_teacher_cannot_publish_other_subject(client,headers,cohort,app):
    with app.state.store.transaction() as d:
        d['roles']['TEACH']={'code':'TEACH','scope':'teaching','screens':['assessments'],'permissions':{}}
        d['accounts']['TEACH']={'code':'TEACH','role_codes':['TEACH']}
        other=next(s['subject_code'] for s in d['records']['curriculum_subjects'].values() if s['semester_number']==2)
    app.dependency_overrides[current_user]=lambda:{'code':'TEACH','person_type':'employee','person_code':'E','client':'teacher-mobile'}
    assert client.post(BASE,json=cohort).status_code==201
    assert client.post(BASE,json={**cohort,'subject_code':other,'semester_number':2}).status_code==403
    app.dependency_overrides.clear()

def test_private_pdf_upload_and_publish_access(client,headers,cohort,app):
    import base64
    files='/api/v1/academics/assignment-workspace/files'
    raw=b'%PDF-1.4\n%%EOF'
    started=client.post(files+'/start',headers=headers,json={'filename':'instructions.pdf','size_bytes':len(raw),'assessment_upload':True})
    assert started.status_code==201,started.text
    code=started.json()['code']
    assert client.post(files+'/'+code+'/chunk',headers=headers,json={'index':0,'content_base64':base64.b64encode(raw).decode()}).status_code==200
    assert client.post(files+'/'+code+'/finish',headers=headers).status_code==200
    draft=client.post(BASE,headers=headers,json={**cohort,'status':'draft','attachments':[code]}).json()
    app.dependency_overrides[current_user]=lambda:{'code':'STUDENT','person_type':'student','person_code':'ST1'}
    assert client.get(files+'/'+code+'/view').status_code==404
    app.dependency_overrides.clear()
    assert client.put(BASE+'/'+draft['code'],headers=headers,json={**cohort,'revision':1,'attachments':[code]}).status_code==200
    # A file already bound to one assessment cannot be reused on another.
    assert client.post(BASE,headers=headers,json={**cohort,'attachments':[code]}).status_code==422
    app.dependency_overrides[current_user]=lambda:{'code':'PARENT','person_type':'parent','person_code':'PAR'}
    assert client.get(files+'/'+code+'/view').content==raw
    app.dependency_overrides[current_user]=lambda:{'code':'OTHER','person_type':'student','person_code':'ST-OTHER'}
    assert client.get(files+'/'+code+'/view').status_code==404
    app.dependency_overrides.clear()

def test_grading_bounds_and_foreign_students_roll_back(client,headers,cohort,app):
    code=client.post(BASE,headers=headers,json=cohort).json()['code']
    with app.state.store.transaction() as d:d['documents']['assessments'][code]['scheduled_at']='2020-01-01T10:00:00+00:00'
    for invalid in [{'student_code':'ST2','marks':'51'},{'student_code':'OTHER','marks':'1'},{'student_code':'ST2','marks':'1','absent':True},{'student_code':'ST1','marks':'1'}]:
        r=client.put(BASE+'/'+code+'/marks',headers=headers,json={'revision':1,'students':[{'student_code':'ST1','marks':'40'},invalid]})
        assert r.status_code==422,r.text
        assert not app.state.store.snapshot()['documents']['assessments'][code]['marks']

def test_push_metadata_targets_assessments(client,headers,cohort,app,monkeypatch):
    from pydantic import SecretStr
    import app.core.integrations_api as integrations
    sent=[]
    monkeypatch.setattr(integrations,'adapter_post',lambda url,token,body:sent.append(body) or {'accepted':True})
    app.state.settings.push_adapter_url='https://adapter.invalid/push'
    app.state.settings.push_adapter_token=SecretStr('test-only')
    with app.state.store.transaction() as d:d['records']['device_tokens']={'DEVICE':{'code':'DEVICE','user_code':'STUDENT','token':'test-token'}}
    r=client.post(BASE,headers=headers,json=cohort)
    assert r.status_code==201,r.text
    assert sent[0]['data']['screen']=='assessments'
    assert sent[0]['data']['assessment_code']==r.json()['code']
    assert 'assignment_code' not in sent[0]['data']

def test_subject_bound_assignments_validate_curriculum(client,headers,cohort):
    body={k:v for k,v in cohort.items() if k not in {'status','scheduled_at'}}
    body['due_at']=cohort['scheduled_at']
    path='/api/v1/academics/assignment-workspace'
    assert client.post(path,headers=headers,json={**body,'subject_code':'OTHER'}).status_code==422
    created=client.post(path,headers=headers,json=body)
    assert created.status_code==201,created.text
    assert created.json()['subject_code']==cohort['subject_code']
    options=client.get(path+'/options',headers=headers,params={'program_code':'P','academic_year_code':'Y'}).json()
    assert len(options['subjects'])==4

def test_parent_child_filter_preserves_switcher_and_limits_results(client,headers,cohort,app):
    client.post(BASE,headers=headers,json=cohort)
    with app.state.store.transaction() as d:d['records']['student_parents']['L2']={'code':'L2','student_code':'ST2','parent_code':'PAR'}
    app.dependency_overrides[current_user]=lambda:{'code':'PARENT','person_type':'parent','person_code':'PAR'}
    result=client.get(BASE,params={'student_code':'ST1'}).json()
    assert {s['code'] for s in result['students']}=={'ST1','ST2'}
    assert result['items'][0]['counts']['assigned']==1
    assert {s['student_code'] for s in result['subjects']}=={'ST1'}
    app.dependency_overrides.clear()

def test_unused_course_can_still_be_deleted_with_generated_plan(client,headers,cohort,app):
    with app.state.store.transaction() as d:
        p={'code':'UNUSED','name':'Unused course','department_code':'D','duration_semesters':1,'course_level':'degree'}
        d['records']['programs']['UNUSED']=p
        insert(d,p,[{'semester_number':1,'subjects':['Fundamentals'],'labs':['Practice']}],True)
    r=client.delete('/api/v1/academics/programs/UNUSED',headers=headers)
    assert r.status_code==204,r.text
    d=app.state.store.snapshot()
    assert 'UNUSED' not in d['records']['programs']
    assert not any(c['program_code']=='UNUSED' for c in d['records']['curriculum_subjects'].values())
