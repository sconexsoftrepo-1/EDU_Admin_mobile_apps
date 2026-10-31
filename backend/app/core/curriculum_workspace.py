"""Editable course semester curricula; generated content is explicitly a starter draft."""
import hashlib
import re
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field
from . import assignment_workspace as aw
from .security import StrictModel,current_user,has_permission
from .storage import audit,now,new_code

router=APIRouter(prefix='/academics/course-curricula',tags=['Course curricula'])

def metadata(data): return data.setdefault('documents',{}).setdefault('course_curricula',{})
def curriculum(data,program_code,year_code=None):
    snapshot=data.get("documents",{}).get("academic_batch_curricula",{}).get(year_code) if year_code else None
    if snapshot and snapshot.get('items') and snapshot.get("program_code")==program_code:
        current={s['code']:s for s in aw.rows(data,'subjects')}
        return {**snapshot,'items':[{**item,'name':current.get(item['subject_code'],{}).get('name',item['name']),'subject_type':current.get(item['subject_code'],{}).get('subject_type',item['subject_type']),'credits':str(current.get(item['subject_code'],{}).get('credits',item.get('credits',0)))} for item in snapshot['items']]}
    subjects={s['code']:s for s in aw.rows(data,'subjects')}
    links=[{**r,'name':subjects.get(r['subject_code'],{}).get('name',r['subject_code']),'subject_type':subjects.get(r['subject_code'],{}).get('subject_type','theory'),'credits':str(subjects.get(r['subject_code'],{}).get('credits',0))} for r in aw.rows(data,'curriculum_subjects') if r['program_code']==program_code]
    return {'program_code':program_code,'items':sorted(links,key=lambda r:(r['semester_number'],r['subject_type'],r['name'])),**metadata(data).get(program_code,{'revision':0,'status':'existing'})}

def starter(program):
    text=(str(program.get('branch',''))+' '+program['name']).lower()
    if program.get('course_level')=='intermediate':
        if 'vocational' in text:
            return [{'semester_number':i,'subjects':['English','Computer applications '+str((i+1)//2),'Office administration '+str((i+1)//2),'Business fundamentals '+str((i+1)//2)],'labs':['Computer applications practical '+str((i+1)//2)]} for i in range(1,int(program.get('duration_semesters') or 4)+1)]
        core=['Mathematics','Physics','Chemistry'] if any(x in text for x in ['mpc','math']) else ['Botany','Zoology','Physics','Chemistry'] if any(x in text for x in ['bipc','bpc','biology']) else ['Mathematics','Economics','Commerce'] if 'mec' in text else ['Civics','Economics','Commerce'] if 'cec' in text else ['History','Economics','Civics']
        return [{'semester_number':i,'subjects':[f'{s} {((i-1)//2)+1}' for s in ['English','Second language',*core]],'labs':[f'{s} practical {((i-1)//2)+1}' for s in core if s in {'Physics','Chemistry','Botany','Zoology'}]} for i in range(1,int(program.get('duration_semesters') or 4)+1)]
    if any(x in text for x in ['computer','bca','b.sc. cs','bsc cs','data science']):
        stages=[['Programming fundamentals','Mathematics for computing','Digital fundamentals'],['Object oriented programming','Discrete mathematics','Computer organization'],['Data structures','Database management systems','Operating systems'],['Computer networks','Software engineering','Web technologies'],['Data analytics','Information security','Cloud computing'],['Artificial intelligence foundations','Software project management','Major project']]
        labs=['Programming laboratory','Object oriented programming laboratory','Database laboratory','Web development laboratory','Data analytics laboratory','Project laboratory']
    elif any(x in text for x in ['commerce','b.com','bcom','bba','management']):
        stages=[['Financial accounting','Business organization','Business economics'],['Advanced accounting','Business statistics','Principles of management'],['Corporate accounting','Business law','Marketing management'],['Cost accounting','Financial management','Human resource management'],['Taxation','Auditing','Entrepreneurship'],['Management accounting','Business analytics','Business project']]
        labs=['Accounting practice','Spreadsheet practice','Accounting software practice','Business research practice','Tax computation practice','Project workshop']
    else:
        discipline=re.sub(r"^(bachelor of |b\.?sc\.? |ba |b\.?com\.? |bba |bca )", "", program['name'],flags=re.I).strip()
        discipline=re.sub(r"\s*\([^)]*\)","",discipline).strip() or "Disciplinary studies"
        stages=[[f'{discipline}: foundations','Academic communication','Digital and quantitative skills'],[f'{discipline}: core concepts',f'{discipline}: methods','Environmental studies'],[f'{discipline}: intermediate studies',f'{discipline}: applications','Research methods'],[f'{discipline}: advanced concepts',f'{discipline}: applied methods','Professional ethics'],[f'{discipline}: specialization',f'{discipline}: research design','Entrepreneurship'],[f'{discipline}: contemporary studies',f'{discipline}: major project','Professional practice']]
        labs=[f'{discipline}: practical workshop {i}' for i in range(1,7)]
    count=int(program.get('duration_semesters') or 6)
    return [{'semester_number':i,'subjects':stages[i-1] if i<=6 else [f'Advanced specialization {i-6}',f'Research project {i-6}'],'labs':[labs[i-1] if i<=6 else f'Research workshop {i-6}']} for i in range(1,count+1)]

def insert(data,program,semesters,generated=False):
    code=program['code']; records=data['records']; records.setdefault('subjects',{}); records.setdefault('curriculum_subjects',{})
    for sem in semesters:
        for kind,key in [('theory','subjects'),('practical','labs')]:
            for raw in sem[key]:
                name=raw.strip()
                digest=hashlib.sha256(f'{code}|{sem["semester_number"]}|{kind}|{name.casefold()}'.encode()).hexdigest()[:20]
                subject='CSUB-'+digest; link='CUR-'+digest
                records['subjects'].setdefault(subject,{'code':subject,'department_code':program['department_code'],'name':name,'credits':'1' if kind=='practical' else '3','subject_type':kind})
                records['curriculum_subjects'][link]={'code':link,'program_code':code,'subject_code':subject,'semester_number':sem['semester_number'],'is_required':True}
    old=metadata(data).get(code,{})
    metadata(data)[code]={'revision':old.get('revision',0)+1,'status':'starter_draft' if generated else 'reviewed','generated':generated,'updated_at':now()}

def seed_missing(data,apply=True):
    # Load once: per-subject existence checks otherwise add thousands of SQL round trips.
    if apply: aw.rows(data,"subjects")
    made=[]
    for p in aw.rows(data,'programs'):
        if p.get('course_level') not in {'intermediate','degree'} or not p.get('department_code'): continue
        existing={r['semester_number'] for r in aw.rows(data,'curriculum_subjects') if r['program_code']==p['code']}
        missing=[sem for sem in starter(p) if sem['semester_number'] not in existing]
        if not missing: continue
        if apply: insert(data,p,missing,True)
        made.append(p['code'])
    return made

class Semester(StrictModel):
    semester_number:int=Field(ge=1,le=16)
    subjects:list[str]=Field(default_factory=list,max_length=30)
    labs:list[str]=Field(default_factory=list,max_length=20)
class CurriculumInput(StrictModel):
    revision:int=Field(ge=0)
    semesters:list[Semester]=Field(min_length=1,max_length=16)

@router.get('/{code}')
def read(code:str,request:Request,user=Depends(current_user)):
    data=request.app.state.store.snapshot()
    if aw.personal(user):
        from .calendar_workspace import programs_for_student
        if code not in {p for s in aw.own_students(data,user) for p in programs_for_student(data,s)}: raise HTTPException(404,'Course not found')
    elif not (has_permission(data,user,'programs','view') or aw.teacher_codes(data,user)): raise HTTPException(403,'Course access denied')
    if code not in data['records'].get('programs',{}): raise HTTPException(404,'Course not found')
    return curriculum(data,code)

@router.put('/{code}')
def update(code:str,body:CurriculumInput,request:Request,user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if not has_permission(data,user,'programs','edit'): raise HTTPException(403,'Course editing is not assigned to this role')
        program=data['records'].get('programs',{}).get(code)
        if not program: raise HTTPException(404,'Course not found')
        if body.revision!=metadata(data).get(code,{}).get('revision',0): raise HTTPException(409,'Curriculum changed; refresh before saving')
        nums=[s.semester_number for s in body.semesters]
        if len(set(nums))!=len(nums) or set(nums)!=set(range(1,int(program['duration_semesters'])+1)): raise HTTPException(422,'Provide every course semester once')
        for sem in body.semesters:
            names=sem.subjects+sem.labs
            if not names or any(not n.strip() or len(n)>180 for n in names) or len({n.strip().casefold() for n in names})!=len(names): raise HTTPException(422,'Enter unique subject and lab names for every semester')
        links=data['records'].setdefault('curriculum_subjects',{})
        for k in [k for k,r in links.items() if r['program_code']==code]: del links[k]
        insert(data,program,[s.model_dump() for s in body.semesters])
        audit(data,user['code'],'curriculum_update','programs',code)
        return curriculum(data,code)


def initialize_batch(data,year):
    """Snapshot the course plan and create dated semester records for new batches."""
    from datetime import date,timedelta
    program=data['records'].get('programs',{}).get(year.get('program_code'),{})
    if not program or not year.get('start_date') or not year.get('end_date'): return
    plan=curriculum(data,program['code'])
    data.setdefault('documents',{}).setdefault('academic_batch_curricula',{}).setdefault(year['code'],{**plan,'academic_year_code':year['code']})
    semesters=data['records'].setdefault('semesters',{})
    if any(s['academic_year_code']==year['code'] for s in semesters.values()): return
    count=int(program.get('duration_semesters') or 0)
    start,end=date.fromisoformat(str(year['start_date'])),date.fromisoformat(str(year['end_date']))
    days=(end-start).days+1
    if not 1<=count<=16 or days<count: return
    generated=[]
    for i in range(count):
        code='SEM-'+hashlib.sha256(f"{year['code']}|{i+1}".encode()).hexdigest()[:20]
        generated.append(code)
        semesters[code]={'code':code,'academic_year_code':year['code'],'name':f'Semester {i+1}','semester_number':i+1,'start_date':(start+timedelta(days=days*i//count)).isoformat(),'end_date':(start+timedelta(days=days*(i+1)//count-1)).isoformat()}

    data['documents']['academic_batch_curricula'][year['code']]['generated_semester_codes']=generated


def remove_generated_semesters(data,year,actor):
    from app.modules.academics.semesters.api import service
    snapshot=data.get('documents',{}).get('academic_batch_curricula',{}).get(year['code'],{})
    if any(a['academic_year_code']==year['code'] for a in data.get('documents',{}).get('assessments',{}).values()): raise HTTPException(409,'This academic batch has assessments')
    for code in snapshot.get('generated_semester_codes',[]):
        if code in data['records'].get('semesters',{}): service.delete(data,code,actor)
    data.get('documents',{}).get('academic_batch_curricula',{}).pop(year['code'],None)


def student_subjects(data,students):
    result=[]
    sections={s['code']:s for s in aw.rows(data,'sections')}
    batches={b['code']:b for b in aw.rows(data,'batches')}
    for student in sorted(students):
        courses={(p['program_code'],p.get('academic_year_code')) for p in aw.rows(data,'student_admission_profiles') if p['student_code']==student and p.get('program_code')}
        for e in aw.rows(data,'student_enrollments'):
            if e['student_code']==student and e.get('status')=='active':
                b=batches.get(sections.get(e['section_code'],{}).get('batch_code'),{})
                if b.get('program_code') and not (not b.get('academic_year_code') and any(p==b['program_code'] and y for p,y in courses)): courses.add((b['program_code'],b.get('academic_year_code')))
        seen=set()
        for program,year in sorted(courses,key=lambda v:(v[0],v[1] or '')):
            from .academic_progress import semester_state
            batch_year=data['records'].get('academic_years',{}).get(year)
            current=semester_state(data,batch_year)['current'] if batch_year else None
            for subject in curriculum(data,program,year)['items']:
                if current and subject['semester_number']!=current: continue
                key=(subject['subject_code'],subject['semester_number'])
                if key in seen: continue
                seen.add(key);result.append({**subject,'student_code':student,'program_code':program})
    return result


def course_workspace(data, code, user):
    program = data['records'].get('programs', {}).get(code)
    if not program:
        raise HTTPException(404, 'Course not found')
    if aw.personal(user) or not (has_permission(data, user, 'programs', 'view') or aw.teacher_codes(data, user)):
        raise HTTPException(403, 'Course access denied')
    can_edit = has_permission(data, user, 'programs', 'edit')
    can_assign = has_permission(data, user, 'subject_offerings', 'create') or has_permission(data, user, 'subject_offerings', 'edit')
    can_view_faculty = can_assign or has_permission(data, user, 'subject_offerings', 'view')
    years = [y for y in aw.rows(data, 'academic_years') if y.get('program_code') == code]
    section_years = {}
    for year in years:
        _, sections, _ = aw.roster(data, year['code'], code)
        for section in sections:
            section_years[section] = year['code']
    semesters = {s['code']:s for s in aw.rows(data, 'semesters')}
    sections = [{**s, 'academic_year_code':section_years[s['code']], 'semester_number':semesters.get(s.get('semester_code'), {}).get('semester_number')}
                for s in aw.rows(data, 'sections') if s['code'] in section_years]
    employees = {e['code']:e for e in aw.rows(data, 'employees')} if can_view_faculty else {}
    teachers = [{'code':t['code'], 'name':aw.name(employees.get(t['employee_code'], {})) or t['code']}
                for t in aw.rows(data, 'teachers') if can_view_faculty and employees.get(t['employee_code'], {}).get('status') == 'active']
    offerings = [o for o in aw.rows(data, 'subject_offerings') if o['section_code'] in section_years] if can_view_faculty else []
    return {**curriculum(data, code), 'can_edit':can_edit, 'can_assign':can_assign,
            'academic_years':[{'code':y['code'], 'name':y['name']} for y in years], 'sections':sections,
            'teachers':teachers, 'offerings':offerings,
            'allocation_revision':data.get('documents', {}).get('course_faculty_revisions', {}).get(code, 0)}


@router.get('/{code}/workspace')
def workspace(code: str, request: Request, user=Depends(current_user)):
    return course_workspace(request.app.state.store.snapshot(), code, user)


class SubjectEdit(StrictModel):
    revision: int = Field(ge=0)
    name: str = Field(min_length=1, max_length=180)
    subject_type: Literal['theory', 'practical', 'project', 'elective'] = 'theory'
    credits: Decimal = Field(default=3, ge=0, le=40, decimal_places=2)


class SubjectCreate(SubjectEdit):
    semester_number: int = Field(ge=1, le=16)


def validate_subject_name(data, code, semester, name, ignore=None):
    if not name.strip():
        raise HTTPException(422, 'Enter the subject or lab name')
    subjects = data['records'].get('subjects', {})
    if any(r['program_code'] == code and r['semester_number'] == semester and r['subject_code'] != ignore
           and subjects.get(r['subject_code'], {}).get('name', '').strip().casefold() == name.strip().casefold()
           for r in aw.rows(data, 'curriculum_subjects')):
        raise HTTPException(409, 'That name already exists in this semester')


def check_plan_revision(data, code, revision, user):
    if not has_permission(data, user, 'programs', 'edit'):
        raise HTTPException(403, 'Course editing is not assigned to this role')
    program = data['records'].get('programs', {}).get(code)
    if not program:
        raise HTTPException(404, 'Course not found')
    if revision != metadata(data).get(code, {}).get('revision', 0):
        raise HTTPException(409, 'Curriculum changed; refresh before saving')
    return program


def bump_plan(data, code, actor):
    old = metadata(data).get(code, {})
    metadata(data)[code] = {**old, 'revision':old.get('revision', 0)+1, 'updated_at':now()}
    audit(data, actor, 'curriculum_subject_edit', 'programs', code)


@router.patch('/{code}/subjects/{link_code}')
def edit_subject(code: str, link_code: str, body: SubjectEdit, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        check_plan_revision(data, code, body.revision, user)
        link = data['records'].get('curriculum_subjects', {}).get(link_code)
        if not link or link['program_code'] != code:
            raise HTTPException(404, 'Subject not found in this course')
        subject_code = link['subject_code']
        if any(r['subject_code'] == subject_code and r['program_code'] != code for r in aw.rows(data, 'curriculum_subjects')):
            raise HTTPException(409, 'This subject is shared by other courses; edit it in the subject catalog')
        validate_subject_name(data, code, link['semester_number'], body.name, subject_code)
        original = data['records']['subjects'][subject_code]
        data['records']['subjects'][subject_code] = {**original, 'name':body.name.strip(), 'subject_type':body.subject_type, 'credits':str(body.credits)}
        bump_plan(data, code, user['code'])
        return course_workspace(data, code, user)


@router.post('/{code}/subjects', status_code=201)
def add_subject(code: str, body: SubjectCreate, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        program = check_plan_revision(data, code, body.revision, user)
        if body.semester_number > int(program['duration_semesters']):
            raise HTTPException(422, 'Choose a semester within the course duration')
        validate_subject_name(data, code, body.semester_number, body.name)
        subject, link = new_code('CSUB'), new_code('CUR')
        data['records'].setdefault('subjects', {})[subject] = {'code':subject, 'department_code':program['department_code'], 'name':body.name.strip(), 'subject_type':body.subject_type, 'credits':str(body.credits)}
        data['records'].setdefault('curriculum_subjects', {})[link] = {'code':link, 'program_code':code, 'subject_code':subject, 'semester_number':body.semester_number, 'is_required':True}
        bump_plan(data, code, user['code'])
        return course_workspace(data, code, user)


class FacultyInput(StrictModel):
    revision: int = Field(ge=0)
    academic_year_code: str
    # Omitted for a batch with one class (or none yet): the allocation uses that class.
    section_code: str | None = None
    subject_code: str
    teacher_code: str
    expected_teacher_code: str | None = None


def batch_section(data, code, body, user):
    """The class a section-less allocation belongs to.

    A batch with a single section for the subject's semester uses it. A batch with no sections at
    all gets one batch-wide section (named after the batch, not tied to a semester) so faculty can
    be allocated; it then shows in every semester like any unlinked section.
    """
    year, codes, _ = aw.roster(data, body.academic_year_code, code)
    item = next((s for s in curriculum(data, code)['items'] if s['subject_code'] == body.subject_code), None)
    semesters = data['records'].get('semesters', {})
    eligible = [c for c in codes
                if not (term := semesters.get(data['records']['sections'][c].get('semester_code')))
                or not item or term['semester_number'] == item['semester_number']]
    if len(eligible) == 1:
        return eligible[0]
    if eligible:
        raise HTTPException(422, 'Select the class section for this allocation')
    if codes:
        raise HTTPException(422, "No section of this batch belongs to the subject's semester; add one before allocating faculty")
    if not has_permission(data, user, 'sections', 'create'):
        raise HTTPException(403, 'Creating the batch section is not assigned to this role')
    from app.modules.academics.academic_years.service import ensure_course_batch
    from app.modules.master_data.onboarding.api import table_service
    batch = ensure_course_batch(data, year, user['code'])
    if not batch:
        raise HTTPException(422, 'Link this academic batch to a course batch before allocating faculty')
    section = table_service('sections').create(
        data, {'code': new_code('SEC'), 'name': batch.get('name') or year.get('name') or batch['code'],
               'batch_code': batch['code']}, user['code'])
    return section['code']


@router.put('/{code}/faculty')
def assign_faculty(code: str, body: FacultyInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if not body.section_code:
            revision = data.get('documents', {}).get('course_faculty_revisions', {}).get(code, 0)
            if revision != body.revision:
                raise HTTPException(409, 'Faculty allocation changed; refresh before saving')
            body = body.model_copy(update={'section_code': batch_section(data, code, body, user)})
        offerings = data['records'].setdefault('subject_offerings', {})
        existing = [o for o in offerings.values() if o['section_code'] == body.section_code and o['subject_code'] == body.subject_code]
        action = 'edit' if existing else 'create'
        if not has_permission(data, user, 'subject_offerings', action):
            raise HTTPException(403, 'Faculty allocation is not assigned to this role')
        aw.roster(data, body.academic_year_code, code, body.section_code)
        revisions = data.setdefault('documents', {}).setdefault('course_faculty_revisions', {})
        if revisions.get(code, 0) != body.revision or len(existing) > 1 or (existing[0]['teacher_code'] if existing else None) != body.expected_teacher_code:
            raise HTTPException(409, 'Faculty allocation changed; refresh before saving')
        item = next((s for s in curriculum(data, code, body.academic_year_code)['items'] if s['subject_code'] == body.subject_code), None)
        extend_batch = item is None
        if not item:
            item = next((s for s in curriculum(data, code)['items'] if s['subject_code'] == body.subject_code), None)
            if item and not has_permission(data, user, 'programs', 'edit'):
                raise HTTPException(403, 'Course edit permission is required to add this subject to the batch plan')
        if not item:
            raise HTTPException(422, 'Select a subject from this course curriculum')
        section = data['records']['sections'][body.section_code]
        semester = data['records'].get('semesters', {}).get(section.get('semester_code'))
        if semester and semester['semester_number'] != item['semester_number']:
            raise HTTPException(422, 'This section is linked to a different semester')
        teacher = data['records'].get('teachers', {}).get(body.teacher_code)
        employee = data['records'].get('employees', {}).get(teacher.get('employee_code')) if teacher else None
        if not employee or employee.get('status') != 'active':
            raise HTTPException(422, 'Select an active faculty member')
        offering = {**(existing[0] if existing else {}), 'code':existing[0]['code'] if existing else new_code('OFFER'), 'subject_code':body.subject_code, 'section_code':body.section_code, 'teacher_code':body.teacher_code}
        offerings[offering['code']] = offering
        members = data['records'].setdefault('student_subjects', {})
        linked = {(m['enrollment_code'], m['offering_code']) for m in members.values()}
        for enrollment in aw.rows(data, 'student_enrollments'):
            if enrollment['section_code'] == body.section_code and enrollment.get('status') == 'active' and (enrollment['code'], offering['code']) not in linked:
                key = new_code('SSUB')
                members[key] = {'code':key, 'enrollment_code':enrollment['code'], 'offering_code':offering['code']}
        if extend_batch:
            snapshot = data.get('documents', {}).get('academic_batch_curricula', {}).get(body.academic_year_code)
            if snapshot:
                snapshot['items'] = [*snapshot['items'], dict(item)]
                snapshot['updated_at'] = now()
        revisions[code] = body.revision + 1
        audit(data, user['code'], 'course_faculty_assign', 'subject_offerings', offering['code'])
        return course_workspace(data, code, user)
