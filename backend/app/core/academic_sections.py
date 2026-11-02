"""Academic cohort creation and previewed, semester-specific section placement."""
import hashlib
import json
import re
from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field
from . import assignment_workspace as aw
from .academic_progress import academic_roster, calendar, semester_state, local_now
from .security import StrictModel, current_user, has_permission
from .storage import audit, new_code, now

router = APIRouter(prefix='/academics/batch-workspace', tags=['Academic batches and sections'])


def require_staff(data, user, resource, action):
    if aw.personal(user) or aw.teaching(user) or not has_permission(data, user, resource, action):
        raise HTTPException(403, 'Academic batch management is not assigned to this role')


def get_year(data, code):
    year = data['records'].get('academic_years', {}).get(code)
    if not year or not year.get('program_code'):
        raise HTTPException(404, 'Academic batch not found')
    return year


def cohort(data, year):
    candidates = [b for b in aw.rows(data, 'batches') if b.get('program_code') == year['program_code']]
    batches = [b for b in candidates if b['code'] == year.get('batch_code')]
    if not batches: batches = [b for b in candidates if b.get('academic_year_code') == year['code']]
    if not batches: batches = [b for b in candidates if not b.get('academic_year_code') and str(b.get('entry_year')) == str(year['start_date'])[:4] and str(b.get('graduation_year')) == str(year['end_date'])[:4]]
    if len(batches) > 1:
        raise HTTPException(409, 'Multiple cohorts match this academic batch; resolve duplicate cohort links first')
    return batches[0] if batches else None


def placements(data, year, semester):
    batch = cohort(data, year)
    term = next((t for t in calendar(data, year) if t['semester_number'] == semester), None)
    if not term:
        raise HTTPException(422, 'Select a semester belonging to this academic batch')
    sections = {s['code']:s for s in aw.rows(data, 'sections') if batch and s['batch_code'] == batch['code'] and (s.get('semester_code') == term['code'] or not s.get('semester_code') and semester == (semester_state(data,year)['current'] or 1))}
    return batch, term, sections


class BatchInput(StrictModel):
    program_code: str
    start_date: date
    end_date: date


@router.post('', status_code=201)
def create_batch(body: BatchInput, request: Request, user=Depends(current_user)):
    from app.modules.academics.academic_years.api import service
    with request.app.state.store.transaction() as data:
        require_staff(data, user, 'academic_years', 'create')
        program=data['records'].get('programs',{}).get(body.program_code,{})
        if (body.end_date-body.start_date).days+1 < 2*int(program.get('duration_semesters') or 1):
            raise HTTPException(422, 'The batch date range is too short for its semester calendar')
        record = service.create(data, body.model_dump(mode='json'), user['code'])
        return dict(record)


@router.get('')
def listing(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    require_staff(data, user, 'academic_years', 'view')
    items = []
    for year in aw.rows(data, 'academic_years'):
        if not year.get('program_code'): continue
        members = academic_roster(data, year, user)
        batch = cohort(data, year)
        sections = [s for s in aw.rows(data, 'sections') if batch and s['batch_code'] == batch['code']]
        items.append({**dict(year), 'course_name': data['records'].get('programs', {}).get(year['program_code'], {}).get('name', year['program_code']),
                      'semester_count':int(data['records'].get('programs',{}).get(year['program_code'],{}).get('duration_semesters') or len(calendar(data,year))), 'students': len(members), 'section_count': len(sections), 'current_semester': semester_state(data, year)['current']})
    return {'items': items, 'can_create': has_permission(data, user, 'academic_years', 'create'),
            'can_manage_sections': all(has_permission(data, user, r, a) for r,a in [('sections','create'),('sections','edit'),('student_enrollments','create'),('student_enrollments','edit')])}


class SectionInput(StrictModel):
    code: str | None = None
    name: str = Field(min_length=1, max_length=80)
    capacity: int | None = Field(default=None, ge=1, le=10000)


class PlacementInput(StrictModel):
    semester_number: int = Field(ge=1, le=24)
    sections: list[SectionInput] = Field(min_length=1, max_length=50)
    order_by: Literal['university_roll_number','admission_number'] = 'university_roll_number'
    overrides: dict[str, int] = Field(default_factory=dict, max_length=10000)
    expected_revision: str | None = None


def natural(value):
    return [(0, int(p)) if p.isdigit() else (1, p.casefold()) for p in re.split(r'(\d+)', str(value)) if p]


def plan(data, year, body, user):
    batch, term, existing = placements(data, year, body.semester_number)
    names = [s.name.strip().casefold() for s in body.sections]
    if any(not n for n in names) or len(set(names)) != len(names):
        raise HTTPException(422, 'Section names must be nonempty and unique')
    codes = [s.code for s in body.sections if s.code]
    if len(codes) != len(set(codes)) or any(c not in existing for c in codes):
        raise HTTPException(422, 'Choose sections belonging to this batch and semester')
    if any(s['name'].strip().casefold() in names and s['code'] not in codes for s in existing.values()):
        raise HTTPException(409, 'A section with this name already exists; select it to manage its placement')
    members = {c:s for c,s in academic_roster(data, year, user).items() if s.get('status','active') == 'active'}
    profiles = {p['student_code']:p for p in aw.rows(data,'student_admission_profiles') if p.get('academic_year_code') == year['code']}
    enrollments = [e for e in aw.rows(data,'student_enrollments') if e['student_code'] in members and e['section_code'] in existing]
    active = {}
    for enrollment in enrollments:
        if enrollment.get('status') == 'active':
            if enrollment['student_code'] in active: raise HTTPException(409, 'A student has multiple active sections in this semester; resolve their enrollment first')
            active[enrollment['student_code']] = enrollment
    rows = []
    for code, student in members.items():
        profile = profiles.get(code,{})
        enrollment = active.get(code,{})
        university = student.get('university_roll_number') or profile.get('university_roll_number') or enrollment.get('university_roll_number')
        academic = student.get('admission_number') or profile.get('registration_number') or code
        roll = str((university or academic) if body.order_by == 'university_roll_number' else academic).strip()
        rows.append({'student_code':code,'name':aw.name(student),'admission_number':str(academic),'university_roll_number':str(university or ''),
                     'roll_number':roll,'current_section_code':enrollment.get('section_code'),
                     'current_section_name':existing.get(enrollment.get('section_code'),{}).get('name','Unassigned')})
    rows.sort(key=lambda r:(natural(r.get(body.order_by) or r['admission_number']), r['student_code']))
    if len({r['roll_number'].casefold() for r in rows}) != len(rows):
        raise HTTPException(422, 'Roll identifiers must be unique across this batch. Correct duplicate university rolls or use admission numbers.')
    if set(body.overrides)-set(members) or any(i<0 or i>=len(body.sections) for i in body.overrides.values()):
        raise HTTPException(422, 'Manual placement must refer to students and sections in this preview')
    size, extra = divmod(len(rows),len(body.sections)); targets = [size+(i<extra) for i in range(len(body.sections))]
    for i,s in enumerate(body.sections):
        if s.capacity is not None and s.capacity < targets[i]: raise HTTPException(422, f'Section {s.name} needs capacity for at least {targets[i]} students')
    assigned = [0]*len(body.sections)
    for row in rows:
        if row['student_code'] in body.overrides:
            index = body.overrides[row['student_code']]; assigned[index]+=1; row['section_index']=index
    for i,s in enumerate(body.sections):
        if s.capacity is not None and assigned[i]>s.capacity: raise HTTPException(422, 'Manual placements exceed section capacity')
    for row in rows:
        if 'section_index' in row: continue
        index = next((i for i in range(len(targets)) if assigned[i]<targets[i]), None)
        if index is None: raise HTTPException(422, 'Manual placements leave no available section')
        row['section_index']=index; assigned[index]+=1
    # Enrollment identity/status, student identifiers and existing section configuration
    # participate in the revision, so a stale preview can never overwrite intervening changes.
    state={'rows':rows,'enrollments':sorted([dict(e) for e in enrollments],key=lambda e:e['code']), 'sections':sorted([dict(s) for s in existing.values()],key=lambda s:s['code']), 'term':term, 'request':body.model_dump(exclude={'expected_revision'})}
    revision = hashlib.sha256(json.dumps(state,sort_keys=True,default=str).encode()).hexdigest()
    for row in rows: row['section_name']=body.sections[row['section_index']].name.strip()
    for row in rows:
        target = body.sections[row['section_index']].code
        if target and any(e['section_code']==target and e['student_code']!=row['student_code'] and str(e.get('roll_number','')).casefold()==row['roll_number'].casefold() for e in aw.rows(data,'student_enrollments')):
            raise HTTPException(409, 'A roll number is already reserved in a target section. Correct the conflicting enrollment before allocating.')
    return {'revision':revision,'students':rows,'total_students':len(rows),'semester_number':body.semester_number,
            'sections':[{'code':s.code,'name':s.name.strip(),'capacity':s.capacity,'students':assigned[i]} for i,s in enumerate(body.sections)]}


@router.get('/{code}/sections')
def detail(code: str, request: Request, semester_number: int, user=Depends(current_user)):
    data=request.app.state.store.snapshot(); require_staff(data,user,'academic_years','view'); year=get_year(data,code)
    _,term,sections=placements(data,year,semester_number)
    members=academic_roster(data,year,user)
    enrollments={e['student_code']:e for e in aw.rows(data,'student_enrollments') if e['student_code'] in members and e['section_code'] in sections and e.get('status')=='active'}
    students=[{'student_code':code,'name':aw.name(student),'admission_number':student.get('admission_number',''),
               'roll_number':enrollments.get(code,{}).get('roll_number') or student.get('university_roll_number') or student.get('admission_number',''),
               'section_name':sections.get(enrollments.get(code,{}).get('section_code'),{}).get('name','Unassigned')}
              for code,student in members.items()]
    students.sort(key=lambda s:natural(s['roll_number'] or s['admission_number']))
    return {'sections':[dict(s) for s in sections.values()], 'students':students, 'semester_number':semester_number, 'semester_name':term['name']}


@router.post('/{code}/sections/preview')
def preview(code: str, body: PlacementInput, request: Request, user=Depends(current_user)):
    data=request.app.state.store.snapshot(); require_staff(data,user,'academic_years','view')
    return plan(data,get_year(data,code),body,user)


@router.post('/{code}/sections/apply')
def apply(code: str, body: PlacementInput, request: Request, user=Depends(current_user)):
    from app.modules.academics.academic_years.service import ensure_course_batch
    from app.modules.master_data.onboarding.api import table_service
    with request.app.state.store.transaction() as data:
        for resource,action in [('academic_years','view'),('sections','create'),('sections','edit'),('student_enrollments','create'),('student_enrollments','edit')]: require_staff(data,user,resource,action)
        year=get_year(data,code); result=plan(data,year,body,user)
        if not body.expected_revision or body.expected_revision != result['revision']: raise HTTPException(409,'The roster or section plan changed. Preview placements again before saving.')
        batch=ensure_course_batch(data,year,user['code'])
        from .curriculum_workspace import initialize_batch
        initialize_batch(data,year)
        term=next(t for t in calendar(data,year) if t['semester_number']==body.semester_number)
        section_codes=[]
        for i,spec in enumerate(body.sections):
            values={'name':spec.name.strip(),'capacity':spec.capacity,'batch_code':batch['code'],'semester_code':term['code']}
            if spec.code: section=table_service('sections').update(data,spec.code,values,user['code'])
            else: section=table_service('sections').create(data,{'code':new_code('SEC'),**values},user['code'])
            section_codes.append(section['code'])
        _,_,semester_sections=placements(data,year,body.semester_number)
        enrollments=data['records'].setdefault('student_enrollments',{})
        for student in result['students']:
            target=section_codes[student['section_index']]
            previous=[e for e in list(enrollments.values()) if e['student_code']==student['student_code'] and e['section_code'] in semester_sections and e.get('status')=='active']
            for enrollment in previous:
                if enrollment['section_code'] != target: table_service('student_enrollments').update(data,enrollment['code'],{'status':'transferred'},user['code'])
            enrollment=next((e for e in enrollments.values() if e['student_code']==student['student_code'] and e['section_code']==target),None)
            if enrollment:
                enrollment=table_service('student_enrollments').update(data,enrollment['code'],{'status':'active','roll_number':student['roll_number']},user['code'])
            else:
                enrollment=table_service('student_enrollments').create(data,{'code':new_code('ENR'),'student_code':student['student_code'],'section_code':target,'roll_number':student['roll_number'],'enrolled_on':local_now().date().isoformat(),'status':'active'},user['code'])
            # Preserve historical subject bindings; register the new section's actual offerings.
            links=data['records'].setdefault('student_subjects',{})
            for offering in aw.rows(data,'subject_offerings'):
                if offering['section_code']==target and not any(l['enrollment_code']==enrollment['code'] and l['offering_code']==offering['code'] for l in links.values()):
                    link=new_code('SSUB'); links[link]={'code':link,'enrollment_code':enrollment['code'],'offering_code':offering['code']}
            # Profile is the current placement only; earlier semester enrollments remain intact.
            if semester_state(data,year)['current']==body.semester_number:
                for profile in aw.rows(data,'student_admission_profiles'):
                    if profile.get('student_code')==student['student_code'] and profile.get('academic_year_code')==year['code']: profile['section_code']=target
        audit(data,user['code'],'allocate_sections','academic_years',code)
        data.setdefault('documents',{}).setdefault('section_placement_history',{})[new_code('PLACEMENT')]={'academic_year_code':code,'semester_number':body.semester_number,'saved_at':now(),'saved_by':user['code'],'sections':section_codes,'students':result['students']}
        return {**result,'section_codes':section_codes}
