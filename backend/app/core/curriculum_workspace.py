"""Editable course semester curricula; generated content is explicitly a starter draft."""
import hashlib
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field
from . import assignment_workspace as aw
from .security import StrictModel,current_user,has_permission
from .storage import audit,now

router=APIRouter(prefix='/academics/course-curricula',tags=['Course curricula'])

def metadata(data): return data.setdefault('documents',{}).setdefault('course_curricula',{})
def curriculum(data,program_code,year_code=None):
    snapshot=data.get("documents",{}).get("academic_batch_curricula",{}).get(year_code) if year_code else None
    if snapshot and snapshot.get('items') and snapshot.get("program_code")==program_code: return snapshot
    subjects={s['code']:s for s in aw.rows(data,'subjects')}
    links=[{**r,'name':subjects.get(r['subject_code'],{}).get('name',r['subject_code']),'subject_type':subjects.get(r['subject_code'],{}).get('subject_type','theory')} for r in aw.rows(data,'curriculum_subjects') if r['program_code']==program_code]
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
            for subject in curriculum(data,program,year)['items']:
                key=(subject['subject_code'],subject['semester_number'])
                if key in seen: continue
                seen.add(key);result.append({**subject,'student_code':student,'program_code':program})
    return result
