"""Batch assessments, private resources, publishing and revision-safe grading."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import Field, model_validator
from . import assignment_workspace as aw
from .security import StrictModel, current_user, has_permission, role_limit
from .storage import audit, new_code, now

router = APIRouter(prefix='/academics/assessment-workspace', tags=['Assessments'])

def docs(data):
    return data.setdefault('documents', {}).setdefault('assessments', {})

def permitted(data, user, action='view'):
    allowed = role_limit(data, user, 'screens')
    return not aw.personal(user) and (allowed is None or 'assessments' in allowed) and (bool(aw.teacher_codes(data,user)) if aw.teaching(user) else has_permission(data,user,'exams',action))

def require(data,user,action='view'):
    if not permitted(data,user,action): raise HTTPException(403,'Assessment access is not assigned to this role')

def completed(record):
    return record['status'] == 'published' and datetime.fromisoformat(record['scheduled_at']) <= datetime.now(timezone.utc)

def can_manage(data,user,record):
    if not permitted(data,user): return False
    if not aw.teaching(user): return True
    return record['teacher_code'] in aw.teacher_codes(data,user)

def get(data,code):
    record=docs(data).get(code)
    if not record: raise HTTPException(404,'Assessment not found')
    return record

def authorize(data,user,record,student_code=None):
    if aw.personal(user):
        own=aw.own_students(data,user,student_code)
        if record['status']!='published' or not own.intersection(record['recipient_student_codes']): raise HTTPException(404,'Assessment not found')
    elif not can_manage(data,user,record): raise HTTPException(404,'Assessment not found')

def present(data,user,record,student_code=None,detail=False):
    authorize(data,user,record,student_code)
    own=aw.own_students(data,user,student_code) if aw.personal(user) else set(record['recipient_student_codes'])
    marks={k:v for k,v in record.get('marks',{}).items() if k in own}
    result={k:v for k,v in record.items() if k not in {'recipient_student_codes','marks','attachments'}}
    result.update(bucket='draft' if record['status']=='draft' else 'completed' if completed(record) else 'upcoming',
        can_manage=can_manage(data,user,record) and permitted(data,user,'edit'), can_grade=can_manage(data,user,record) and permitted(data,user,'edit') and completed(record),
        course_name=data['records'].get('programs',{}).get(record['program_code'],{}).get('name',record['program_code']),
        batch_name=data['records'].get('academic_years',{}).get(record['academic_year_code'],{}).get('name',record['academic_year_code']),
        subject_name=data['records'].get('subjects',{}).get(record['subject_code'],{}).get('name',record['subject_code']),
        attachments=[aw.file_public(aw.docs(data,'files')[f]) for f in record['attachments']], marks=marks,
        counts={'assigned':len(record['recipient_student_codes']) if not aw.personal(user) else len(own.intersection(record['recipient_student_codes'])), 'graded':sum(m.get('marks') is not None or m.get('absent',False) for m in marks.values())})
    if detail:
        result['students']=[{'code':code,'name':aw.name(data['records'].get('students',{}).get(code,{})), 'mark':marks.get(code)} for code in record['recipient_student_codes'] if code in own]
    return result

class AssessmentInput(StrictModel):
    title: str=Field(min_length=1,max_length=180)
    description: str=Field(default='',max_length=20000)
    guidance: str=Field(default='',max_length=20000)
    course_level: Literal['intermediate','degree']
    program_code: str
    academic_year_code: str
    section_code: str | None=None
    teacher_code: str | None=None
    subject_code: str
    semester_number: int=Field(ge=1,le=16)
    scheduled_at: datetime
    max_marks: Decimal=Field(gt=0,le=10000)
    status: Literal['draft','published']='draft'
    attachments: list[str]=Field(default_factory=list,max_length=10)
    revision: int=Field(default=0,ge=0)
    @model_validator(mode='after')
    def check(self):
        if not self.title.strip(): raise ValueError('Enter an assessment name')
        if self.scheduled_at.tzinfo is None: raise ValueError('Include a time zone')
        return self

@router.get('/options')
def options(request:Request,program_code:str|None=None,academic_year_code:str|None=None,section_code:str|None=None,user=Depends(current_user)):
    data=request.app.state.store.snapshot(); require(data,user)
    from .curriculum_workspace import curriculum
    own=aw.teacher_codes(data,user)
    offerings=[o for o in aw.rows(data,'subject_offerings') if not aw.teaching(user) or o['teacher_code'] in own]
    owned_sections={o['section_code'] for o in offerings}
    years=[]
    for y in aw.rows(data,'academic_years'):
        if not y.get('program_code'): continue
        _, sections, _=aw.roster(data,y['code'],y['program_code'])
        if not aw.teaching(user) or sections & owned_sections: years.append(y)
    courses=[p for p in aw.rows(data,'programs') if p.get('course_level') in {'intermediate','degree'} and (not aw.teaching(user) or p['code'] in {y['program_code'] for y in years})]
    sections=[]; students={}
    if program_code and academic_year_code:
        students=aw.teacher_scope(data,user,academic_year_code,program_code,section_code)
        _,sc,_=aw.roster(data,academic_year_code,program_code)
        sections=[s for s in aw.rows(data,'sections') if s['code'] in sc and (not aw.teaching(user) or s['code'] in owned_sections)]
    subjects=curriculum(data,program_code,academic_year_code)['items'] if program_code else []
    if aw.teaching(user): subjects=[s for s in subjects if any(o['subject_code']==s['subject_code'] and (not academic_year_code or o['section_code'] in {s['code'] for s in sections}) for o in offerings)]
    return {'courses':courses,'academic_years':years,'sections':sections,'subjects':subjects,'students':[{'code':s['code'],'name':aw.name(s)} for s in students.values()], 'teachers':[{'code':t['code'],'name':aw.name(data['records'].get('employees',{}).get(t['employee_code'],{}))} for t in aw.rows(data,'teachers') if not aw.teaching(user) or t['code'] in own], 'can_create':permitted(data,user,'create')}

def notices(data,students,title,body,code):
    codes=aw.notifications(data,set(students),title,body,code)
    for n in codes:
        record=data['records']['notifications'][n]
        record.pop('assignment_code',None); record['assessment_code']=code
    return codes

def save(body,request,background,user,code=None):
    with request.app.state.store.transaction() as data:
        require(data,user,'edit' if code else 'create')
        previous=get(data,code) if code else None
        if previous:
            authorize(data,user,previous)
            if previous['status']=='published': raise HTTPException(409,'Published assessments are locked; create a new assessment to change the audience or schedule')
        if body.revision != (previous['revision'] if previous else 0): raise HTTPException(409,'Assessment changed; refresh before saving')
        program=data['records'].get('programs',{}).get(body.program_code,{})
        if program.get('course_level')!=body.course_level: raise HTTPException(422,'Select the matching course level')
        roster=aw.teacher_scope(data,user,body.academic_year_code,body.program_code,body.section_code)
        if not roster: raise HTTPException(422,'No active students in this academic batch')
        from .curriculum_workspace import curriculum
        if not any(s['subject_code']==body.subject_code and s['semester_number']==body.semester_number for s in curriculum(data,body.program_code,body.academic_year_code)['items']): raise HTTPException(422,'Select a subject from this course semester')
        teacher=next(iter(aw.teacher_codes(data,user)),None) if aw.teaching(user) else body.teacher_code
        if not teacher or teacher not in data['records'].get('teachers',{}): raise HTTPException(422,'Select a registered teacher')
        _,sections,_=aw.roster(data,body.academic_year_code,body.program_code,body.section_code)
        if aw.teaching(user) and not any(o['teacher_code']==teacher and o['subject_code']==body.subject_code and o['section_code'] in ({body.section_code} if body.section_code else sections) for o in aw.rows(data,'subject_offerings')): raise HTTPException(403,'This subject is outside your teaching allocation')
        year=data['records']['academic_years'][body.academic_year_code]
        from zoneinfo import ZoneInfo
        day=body.scheduled_at.astimezone(ZoneInfo('Asia/Kolkata')).date().isoformat()
        if not str(year['start_date'])<=day<=str(year['end_date']): raise HTTPException(422,'Assessment date must fall within the batch dates')
        if body.status=='published' and body.scheduled_at<=datetime.now(timezone.utc): raise HTTPException(422,'Choose a future assessment date before publishing')
        aw.validate_files(data,body.attachments,user)
        for f in body.attachments:
            file=aw.docs(data,'files')[f]
            if not file.get('assessment_upload') or file.get('assessment_code') not in (None,code): raise HTTPException(422,'Select assessment attachments only')
        code=code or new_code('ASSESS')
        record={**body.model_dump(mode='json'),'code':code,'teacher_code':teacher,'title':body.title.strip(),'recipient_student_codes':sorted(roster),'marks':{},'revision':body.revision+1,'created_by':user['code'],'created_at':previous['created_at'] if previous else now()}
        docs(data)[code]=record
        for f in body.attachments: aw.docs(data,'files')[f]['assessment_code']=code
        notice=notices(data,roster,'Assessment: '+record['title'],'Scheduled '+body.scheduled_at.isoformat()+'. Open Assessments for instructions.',code) if body.status=='published' else []
        audit(data,user['code'],'assessment_save','exams',code)
        result=present(data,user,record,detail=True)
    background.add_task(aw.dispatch_push,request,notice)
    return result

@router.post('',status_code=201)
def create(body:AssessmentInput,request:Request,background:BackgroundTasks,user=Depends(current_user)): return save(body,request,background,user)
@router.put('/{code}')
def update(code:str,body:AssessmentInput,request:Request,background:BackgroundTasks,user=Depends(current_user)): return save(body,request,background,user,code)

@router.get('')
def listing(request:Request,student_code:str|None=None,user=Depends(current_user)):
    data=request.app.state.store.snapshot()
    all_own=aw.own_students(data,user) if aw.personal(user) else set()
    own=aw.own_students(data,user,student_code) if aw.personal(user) else set()
    if not aw.personal(user): require(data,user)
    records=[r for r in docs(data).values() if r['status']=='published' and own.intersection(r['recipient_student_codes'])] if aw.personal(user) else [r for r in docs(data).values() if can_manage(data,user,r)]
    items=[present(data,user,r,student_code) for r in sorted(records,key=lambda r:r['scheduled_at'])]
    graded=[(float(m['marks'] or 0),float(a['max_marks']),a) for a in items for m in a['marks'].values() if m.get('marks') is not None or m.get('absent')]
    def analysis(values):
        total=sum(v[1] for v in values)
        return {'graded':len(values),'percentage':round(sum(v[0] for v in values)/total*100,1) if total else None}
    from .curriculum_workspace import student_subjects
    return {'subjects':student_subjects(data,own), 'items':items,'can_create':permitted(data,user,'create'),'students':[{'code':s,'name':aw.name(data['records'].get('students',{}).get(s,{}))} for s in sorted(all_own)],'performance':analysis(graded),'subject_performance':[{'code':c,'name':data['records'].get('subjects',{}).get(c,{}).get('name',c),**analysis([v for v in graded if v[2]['subject_code']==c])} for c in sorted({v[2]['subject_code'] for v in graded})], 'student_performance':[{'code':student,'name':aw.name(data['records'].get('students',{}).get(student,{})),**analysis([(float(m['marks'] or 0),float(a['max_marks']),a) for a in items for s,m in a['marks'].items() if s==student and (m.get('marks') is not None or m.get('absent'))])} for student in sorted({s for a in items for s in a['marks']})], 'batch_performance':[{'code':b,'name':data['records'].get('academic_years',{}).get(b,{}).get('name',b),**analysis([v for v in graded if v[2]['academic_year_code']==b])} for b in sorted({v[2]['academic_year_code'] for v in graded})]}

@router.get('/{code}')
def detail(code:str,request:Request,student_code:str|None=None,user=Depends(current_user)):
    data=request.app.state.store.snapshot(); return present(data,user,get(data,code),student_code,True)

class Mark(StrictModel):
    student_code:str
    marks:Decimal|None=Field(default=None,ge=0)
    feedback:str=Field(default='',max_length=2000)
    absent:bool=False
class Grade(StrictModel):
    revision:int=Field(ge=1)
    students:list[Mark]=Field(min_length=1,max_length=1000)

@router.put('/{code}/marks')
def grade(code:str,body:Grade,request:Request,background:BackgroundTasks,user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        require(data,user,'edit'); record=get(data,code); authorize(data,user,record)
        if not completed(record): raise HTTPException(409,'Marks open after the assessment date and time')
        if body.revision!=record['revision']: raise HTTPException(409,'Marks changed; refresh before saving')
        if len({r.student_code for r in body.students})!=len(body.students): raise HTTPException(422,'Duplicate student')
        notice=[]
        for row in body.students:
            if row.student_code not in record['recipient_student_codes']: raise HTTPException(422,'Student is outside this assessment')
            if row.marks is not None and (row.absent or row.marks>Decimal(record['max_marks'])): raise HTTPException(422,'Marks exceed maximum or conflict with absence')
            value={**row.model_dump(mode='json'),'reviewed_by':user['code'],'reviewed_at':now()}
            old=record['marks'].get(row.student_code)
            record['marks'][row.student_code]=value
            if (not old or any(old.get(k)!=value[k] for k in ('marks','feedback','absent'))) and (row.marks is not None or row.absent): notice+=notices(data,{row.student_code},'Assessment results: '+record['title'],'Your assessment result is available in Assessments.',code)
        record['revision']+=1
        audit(data,user['code'],'assessment_marks','exam_results',code)
        result=present(data,user,record,detail=True)
    background.add_task(aw.dispatch_push,request,notice)
    return result
