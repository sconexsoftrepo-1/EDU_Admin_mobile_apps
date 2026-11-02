"""Shared semester timeline, final results, backlogs and role-scoped academic analytics."""
import hashlib
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from typing import Literal
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import Field
from . import assignment_workspace as aw
from .curriculum_workspace import curriculum
from .security import StrictModel, current_user, has_permission
from .storage import audit, new_code, now

router = APIRouter(prefix='/academics/semester-workspace', tags=['Semester academic progress'])
ZONE = ZoneInfo('Asia/Kolkata')


def revision_value(value):
    return value.get("revision",0) if isinstance(value,dict) else int(value or 0)


def local_now():
    return datetime.now(ZONE)


def results(data):
    return data.setdefault('documents', {}).setdefault('semester_results', {})


def can_view(data, user):
    return aw.personal(user) or bool(aw.teacher_codes(data, user)) or any(has_permission(data, user, resource, 'view') for resource in ('academic_years', 'exam_results', 'programs'))


def can_grade(data, user):
    return not aw.personal(user) and (bool(aw.teacher_codes(data, user)) if aw.teaching(user) else has_permission(data, user, 'exam_results', 'edit'))


def calendar(data, year):
    items = sorted([dict(s) for s in aw.rows(data, 'semesters') if s['academic_year_code'] == year['code']], key=lambda s:s['semester_number'])
    if items:
        generated=set(data.get('documents',{}).get('academic_batch_curricula',{}).get(year['code'],{}).get('generated_semester_codes',[]))
        reviewed=data.get('documents',{}).get('semester_calendar_reviewed',{}).get(year['code'],False)
        return [{**item,'estimated':item['code'] in generated and not reviewed} for item in items]
    program = data['records'].get('programs', {}).get(year.get('program_code'), {})
    count = int(program.get('duration_semesters') or 0)
    if not count or not year.get('start_date') or not year.get('end_date'):
        return []
    start, end = date.fromisoformat(str(year['start_date'])[:10]), date.fromisoformat(str(year['end_date'])[:10])
    days = (end-start).days+1
    return [{'code':f'{year["code"]}:S{n+1}', 'academic_year_code':year['code'], 'semester_number':n+1,
             'name':f'Semester {n+1}', 'start_date':(start+timedelta(days=days*n//count)).isoformat(),
             'end_date':(start+timedelta(days=days*(n+1)//count-1)).isoformat(), 'estimated':True} for n in range(count)]


def semester_state(data, year, on=None):
    anchor = on or local_now().date()
    terms = calendar(data, year)
    active = [s for s in terms if str(s['start_date'])[:10] <= anchor.isoformat() <= str(s['end_date'])[:10]]
    if len(active)>1:
        return {'current':None, 'state':'calendar_conflict', 'semesters':terms}
    if active:
        return {'current':active[0]['semester_number'], 'state':'ongoing', 'semesters':terms}
    state = 'upcoming' if terms and anchor.isoformat()<str(terms[0]['start_date'])[:10] else 'completed' if terms and anchor.isoformat()>str(terms[-1]['end_date'])[:10] else 'semester_break'
    return {'current':None, 'state':state, 'semesters':terms}


def eligible_batches(data, user, student=None):
    if not can_view(data, user):
        raise HTTPException(403, 'Academic progress access is not assigned to this role')
    own = aw.own_students(data, user, student) if aw.personal(user) else None
    years = []
    members = {}
    for year in aw.rows(data, 'academic_years'):
        if not year.get('program_code'):
            continue
        try:
            roster = academic_roster(data,year,user)
        except HTTPException as e:
            if e.status_code==403: continue
            raise
        if own is not None:
            roster = {s:r for s,r in roster.items() if s in own}
        if (aw.personal(user) or aw.teaching(user)) and not roster:
            continue
        years.append(year); members[year['code']] = roster
    return years, members


def result_rows(data):
    """Final published attempts only; assessment marks never create an inferred backlog."""
    values = list(results(data).values())
    papers = {p['code']:p for p in aw.rows(data,'exam_papers')}
    exams = {e['code']:e for e in aw.rows(data,'exams')}
    terms = {s['code']:s for s in aw.rows(data,'semesters')}
    offerings = {o['code']:o for o in aw.rows(data,'subject_offerings')}
    for row in aw.rows(data,'exam_results'):
        if not row.get('published'): continue
        paper = papers.get(row['paper_code'],{}); exam = exams.get(paper.get('exam_code'),{}); term = terms.get(exam.get('semester_code'),{}); offering = offerings.get(paper.get('offering_code'),{})
        if not term or not offering or exam.get('exam_type')=='internal': continue
        values.append({'code':row['code'],'student_code':row['student_code'],'academic_year_code':term['academic_year_code'],'semester_number':term['semester_number'],
                       'subject_code':offering['subject_code'],'marks':row.get('marks'),'max_marks':paper['max_marks'],'pass_marks':paper['pass_marks'],
                       'absent':row.get('is_absent',False),'published':True,'attempt':2 if exam.get('exam_type')=='supplementary' else 1,'assessed_on':str(paper['exam_date'])[:10],'legacy':True})
    return values


def latest_results(data, year_code, student_codes):
    latest = {}
    for row in result_rows(data):
        if row['academic_year_code']!=year_code or row['student_code'] not in student_codes or not row.get('published'): continue
        key=(row['student_code'],row['semester_number'],row['subject_code'])
        old=latest.get(key)
        rank=lambda r:(int(r.get('attempt',1)),str(r.get('assessed_on','')),str(r.get('updated_at','')))
        if old is None or rank(row)>rank(old): latest[key]=row
    return latest


def passed(row):
    return not row.get('absent') and row.get('marks') is not None and Decimal(str(row['marks']))>=Decimal(str(row['pass_marks']))


def progress_for_batch(data, year, members, user):
    plan=curriculum(data,year['program_code'],year['code'])['items']
    final=latest_results(data,year['code'],set(members))
    if aw.teaching(user):
        _, class_sections, _=aw.roster(data,year['code'],year['program_code'])
        owned_offerings=[o for o in aw.rows(data,'subject_offerings') if o['teacher_code'] in aw.teacher_codes(data,user) and o['section_code'] in class_sections]
        subject_members={}
        for offering in owned_offerings:
            subject_members.setdefault(offering['subject_code'],set()).update(e['student_code'] for e in aw.rows(data,'student_enrollments') if e['section_code']==offering['section_code'] and e.get('status') in {'active','completed'})
        plan=[s for s in plan if s['subject_code'] in subject_members]
        final={k:v for k,v in final.items() if k[0] in subject_members.get(k[2],set())}
    terms=calendar(data,year); summaries=[]; students=[]
    for n in sorted({s['semester_number'] for s in plan}):
        required={s['subject_code'] for s in plan if s['semester_number']==n and s.get('is_required',True)}
        scored=[v for (student,term,subject),v in final.items() if term==n and subject in required and (v.get('marks') is not None or v.get('absent'))]
        clear=backlog=pending=0
        for student,person in members.items():
            individual=required if not aw.teaching(user) else {subject for subject in required if student in subject_members.get(subject,set())}
            marks=[final.get((student,n,subject)) for subject in sorted(individual)]
            failures=[r for r in marks if r and (r.get('marks') is not None or r.get('absent')) and not passed(r)]
            missing=sum(r is None or r.get('marks') is None and not r.get('absent') for r in marks)
            status='backlogs' if failures else 'all_clear' if individual and missing==0 else 'pending'
            clear+=status=='all_clear';backlog+=status=='backlogs';pending+=status=='pending'
            students.append({'code':student,'name':aw.name(person),'semester_number':n,'status':status,'pending_subjects':missing,
                             'backlogs':[{'subject_code':r['subject_code'],'subject_name':data['records'].get('subjects',{}).get(r['subject_code'],{}).get('name',r['subject_code']),'marks':r.get('marks'),'max_marks':r['max_marks'],'pass_marks':r['pass_marks'],'absent':r.get('absent',False),'attempt':r.get('attempt',1)} for r in failures]})
        maximum=sum(Decimal(str(r['max_marks'])) for r in scored)
        earned=sum(Decimal(str(r.get('marks') or 0)) for r in scored)
        term=next((t for t in terms if t['semester_number']==n),{})
        summaries.append({'semester_number':n,'students':len(members),'all_clear':clear,'backlog_students':backlog,'pending_students':pending,'graded_subject_results':len(scored),'earned_marks':str(earned),'max_marks':str(maximum),'percentage':round(float(earned/maximum*100),2) if maximum else None,'start_date':term.get('start_date'),'end_date':term.get('end_date'),'estimated':term.get('estimated',False)})
    groups=[]
    revisions=data.get('documents',{}).get('semester_result_revisions',{})
    for row in results(data).values():
        if row['academic_year_code']==year['code'] and row['student_code'] in members and row['subject_code'] in {s['subject_code'] for s in plan}:
            key=result_key(year['code'],row['semester_number'],row['subject_code'],row.get('attempt',1))
            value={'subject_code':row['subject_code'],'semester_number':row['semester_number'],'attempt':row.get('attempt',1),'revision':revision_value(revisions.get(key))}
            if value not in groups: groups.append(value)
    section_rows={s['code']:s for s in aw.rows(data,'sections')}
    _, batch_sections, _=aw.roster(data,year['code'],year['program_code'])
    visible_sections={e['section_code'] for e in aw.rows(data,'student_enrollments') if e['student_code'] in members and e.get('status') in {'active','completed'}}
    people={e['code']:e for e in aw.rows(data,'employees')};teachers={t['code']:t for t in aw.rows(data,'teachers')}
    for item in plan:
        item['eligible_student_codes']=sorted(set(members) if not aw.teaching(user) else set(members)&subject_members.get(item['subject_code'],set()))
        item['faculty']=[{'teacher_code':o['teacher_code'],'teacher_name':aw.name(people.get(teachers.get(o['teacher_code'],{}).get('employee_code'),{})), 'section_code':o['section_code'],'section_name':section_rows.get(o['section_code'],{}).get('name','')}
                         for o in aw.rows(data,'subject_offerings') if o['subject_code']==item['subject_code'] and o['section_code'] in batch_sections and (not aw.personal(user) or o['section_code'] in visible_sections) and (not aw.teaching(user) or o['teacher_code'] in aw.teacher_codes(data,user))]
    return {'semesters':summaries,'students':students,'results':list(final.values()),'result_groups':groups,'subjects':plan}


def today_classes(data, user, year, student_codes=None, instant=None):
    instant=instant or local_now(); day=instant.date(); state=semester_state(data,year,day)
    current=state['current']
    if not current: return []
    subjects={s['subject_code']:s for s in curriculum(data,year['program_code'],year['code'])['items'] if s['semester_number']==current}
    _, sections, _=aw.roster(data,year['code'],year['program_code'])
    if student_codes is not None:
        sections &= {e['section_code'] for e in aw.rows(data,'student_enrollments') if e['student_code'] in student_codes and e.get('status') in {'active','completed'}}
    own=aw.teacher_codes(data,user)
    all_offerings={o['code']:o for o in aw.rows(data,'subject_offerings') if o['section_code'] in sections and o['subject_code'] in subjects}
    offerings={code:o for code,o in all_offerings.items() if not aw.teaching(user) or o['teacher_code'] in own}
    employees={e['code']:e for e in aw.rows(data,'employees')}; teachers={t['code']:t for t in aw.rows(data,'teachers')}
    all_slots=[dict(s) for s in aw.rows(data,'timetable_slots') if s['offering_code'] in all_offerings and int(s['weekday'])==day.isoweekday()]
    section_rows={s['code']:s for s in aw.rows(data,'sections')}
    batch_codes={section_rows[section]['batch_code'] for section in sections}
    for timetable in data.get('documents',{}).get('timetables',{}).values():
        if timetable.get('status')!='Published' or timetable.get('batch_code') not in batch_codes or int(timetable.get('semester',0))!=current: continue
        matching={section for section in sections if section_rows[section]['name']==timetable.get('section')}
        if not matching: continue
        for cell in timetable.get('cells',[]):
            if cell['day']!=day.weekday() or cell.get('subject_code') not in subjects: continue
            for section in matching:
                offering=next((o for o in all_offerings.values() if o['section_code']==section and o['subject_code']==cell['subject_code']),None)
                if not offering: continue
                periods=timetable['periods']; index=cell['row']; last=index+cell.get('span',1)-1
                start=periods[index]['start'];end=periods[last]['end']
                all_slots=[s for s in all_slots if not (all_offerings[s['offering_code']]['section_code']==section and str(s['start_time'])[:5]==start)]
                all_slots.append({'code':f"{timetable['code']}:{cell['day']}:{index}",'offering_code':offering['code'],'weekday':day.isoweekday(),'start_time':start,'end_time':end,'room_name':cell.get('room',''),'template_code':timetable['code']})
    slots=[s for s in all_slots if s['offering_code'] in offerings]
    slots.sort(key=lambda s:(str(s['start_time']),s['code']))
    times={section:{time:i+1 for i,time in enumerate(sorted({str(s['start_time'])[:5] for s in all_slots if all_offerings[s['offering_code']]['section_code']==section}))} for section in sections}
    items=[]
    for slot in slots:
        offering=offerings[slot['offering_code']]; start=str(slot['start_time'])[:5];end=str(slot['end_time'])[:5]
        clock=instant.strftime('%H:%M')
        items.append({**slot,'start_time':start,'end_time':end,'subject_code':offering['subject_code'],'subject_name':subjects[offering['subject_code']]['name'],
                      'teacher_code':offering['teacher_code'],'teacher_name':aw.name(employees.get(teachers.get(offering['teacher_code'],{}).get('employee_code'),{})),
                      'program_code':year['program_code'],'academic_year_code':year['code'],'section_code':offering['section_code'],'semester_number':current,'period':times[offering['section_code']][start],
                      'state':'ongoing' if start<=clock<end else 'upcoming' if clock<start else 'completed','session_date':day.isoformat(),
                      'can_take_attendance':not aw.personal(user) and (has_permission(data,user,'student_attendance','create') or aw.teaching(user)) and start<=clock})
    return items


def fee_progress(data, students):
    from app.modules.finance.transactions.api import calculate_ledger
    structures={s['code']:s for s in aw.rows(data,'fee_structures')}
    items=[]
    for student in sorted(students):
        ledger=calculate_ledger(data,student)
        for plan in ledger.get('course_plans',[]):
            for term in plan['terms']:
                due=term.get('due_date');remaining=Decimal(term['balance'])
                state='paid' if remaining<=0 else 'unscheduled' if not due else 'overdue' if str(due)[:10]<local_now().date().isoformat() else 'due_soon' if str(due)[:10]<=(local_now().date()+timedelta(days=7)).isoformat() else 'scheduled'
                items.append({'code':f"PLAN:{student}:{plan['academic_year_code']}:{term['semester']}",'student_code':student,'fee_head':'Course fee plan','semester_number':term['semester'],'academic_year_code':plan['academic_year_code'],'amount':term['total'],'paid':term['paid'],'outstanding':term['balance'],'due_date':due,'reminder_state':state,'derived_from_full_course':True})
        for charge in ledger['charges']:
            if structures[charge['fee_structure_code']].get('fee_basis')=='full_course':continue
            structure=structures[charge['fee_structure_code']]
            explicit=charge.get('semester_number') or (structure.get('semester_number') if structure.get('fee_basis')=='semester' else None)
            due=str(charge['due_date'])[:10]; remaining=Decimal(charge['outstanding'])
            items.append({**charge,'semester_number':int(explicit) if explicit else None,'academic_year_code':structure['academic_year_code'],'reminder_state':'paid' if remaining<=0 else 'overdue' if due<local_now().date().isoformat() else 'due_soon' if due<=(local_now().date()+timedelta(days=7)).isoformat() else 'scheduled'})
    return items


def enrollment_placements(data, year, members):
    _, section_codes, _ = aw.roster(data, year['code'], year['program_code'])
    sections = {s['code']:s for s in aw.rows(data,'sections') if s['code'] in section_codes}
    terms = {t['code']:t['semester_number'] for t in calendar(data,year)}
    current = semester_state(data,year)['current']
    return [{'student_code':e['student_code'], 'student_name':aw.name(members[e['student_code']]),
             'admission_number':members[e['student_code']].get('admission_number'), 'roll_number':e.get('roll_number') or members[e['student_code']].get('admission_number',''),
             'section_code':e['section_code'], 'section_name':sections[e['section_code']]['name'],
             'semester_number':terms.get(sections[e['section_code']].get('semester_code'), current), 'status':e['status']}
            for e in aw.rows(data,'student_enrollments') if e['student_code'] in members and e['section_code'] in sections and e.get('status') in {'active','completed'}]


@router.get('')
def overview(request: Request, program_code: str|None=None, academic_year_code: str|None=None, student_code: str|None=None, semester_number: int|None=None, user=Depends(current_user)):
    data=request.app.state.store.snapshot(); years,members=eligible_batches(data,user,student_code)
    options=years
    selected=[y for y in years if (not program_code or y['program_code']==program_code) and (not academic_year_code or y['code']==academic_year_code)]
    if academic_year_code and not selected: raise HTTPException(404,'Academic batch not found')
    own=aw.own_students(data,user) if aw.personal(user) else set()
    output=[]; classes=[]
    for year in selected:
        progress=progress_for_batch(data,year,members[year['code']],user)
        output.append({'code':year['code'],'name':year['name'],'program_code':year['program_code'],'course_name':data['records']['programs'][year['program_code']]['name'],
                       'placements':enrollment_placements(data,year,members[year['code']]), 'timeline':semester_state(data,year),'calendar_revision':revision_value(data.get('documents',{}).get('semester_calendar_revisions',{}).get(year['code'])),'sections':[{'code':s['code'],'name':s['name']} for s in aw.rows(data,'sections') if s['code'] in aw.roster(data,year['code'],year['program_code'])[1]],**progress})
        classes+=today_classes(data,user,year,set(members[year['code']]) if aw.personal(user) else None)
    selected_students={s for y in selected for s in members[y['code']]}
    financial=aw.personal(user) or has_permission(data,user,'student_fee_charges','view')
    fees=fee_progress(data,selected_students) if financial else []
    comparisons=[]
    for program in sorted({b['program_code'] for b in output}):
        values=[term for b in output if b['program_code']==program for term in b['semesters']]
        earned=sum(Decimal(t['earned_marks']) for t in values); maximum=sum(Decimal(t['max_marks']) for t in values)
        comparisons.append({'code':program,'name':data['records']['programs'][program]['name'],'percentage':round(float(earned/maximum*100),2) if maximum else None,'earned_marks':str(earned),'max_marks':str(maximum)})
    earned=sum(Decimal(c['earned_marks']) for c in comparisons);maximum=sum(Decimal(c['max_marks']) for c in comparisons)
    return {'can_manage_batches':not aw.personal(user) and not aw.teaching(user) and has_permission(data,user,'academic_years','view'),'course_comparison':comparisons,'college_percentage':round(float(earned/maximum*100),2) if maximum else None,'can_manage_calendar':not aw.personal(user) and has_permission(data,user,'academic_years','edit'), 'generated_at':local_now().isoformat(),'personal':aw.personal(user),'teacher':aw.teaching(user),'can_grade':can_grade(data,user),
            'courses':[{'code':p['code'],'name':p['name'],'course_level':p.get('course_level'),'branch':p.get('branch')} for p in aw.rows(data,'programs') if p['code'] in {y['program_code'] for y in options}],
            'academic_years':[{'code':y['code'],'name':y['name'],'program_code':y['program_code']} for y in options],
            'children':[{'code':s,'name':aw.name(data['records']['students'].get(s,{}))} for s in sorted(own)],'batches':output,'today_classes':classes,'fees':[f for f in fees if not semester_number or f['semester_number']==semester_number or f['semester_number'] is None],
            'payments':[p for p in aw.rows(data,'payments') if financial and p['student_code'] in selected_students],
            'payment_allocations':[a for a in aw.rows(data,'payment_allocations') if financial and a['charge_code'] in {f['code'] for f in fees}],
            'totals':{'students':len(selected_students),'batches':len(output),'backlog_students':len({s['code'] for b in output for s in b['students'] if s['status']=='backlogs'}),'all_clear_semester_results':sum(s['all_clear'] for b in output for s in b['semesters'])}}


class FinalMark(StrictModel):
    student_code:str
    marks:Decimal|None=Field(default=None,ge=0)
    absent:bool=False

class FinalResults(StrictModel):
    academic_year_code:str
    program_code:str
    semester_number:int=Field(ge=1,le=16)
    subject_code:str
    max_marks:Decimal=Field(gt=0,le=10000)
    pass_marks:Decimal=Field(ge=0,le=10000)
    assessed_on:date
    attempt:int=Field(default=1,ge=1,le=20)
    published:bool=True
    revision:int=Field(ge=0)
    students:list[FinalMark]=Field(min_length=1,max_length=1000)


@router.put('/results')
def save_results(body:FinalResults,request:Request,background:BackgroundTasks,user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if not can_grade(data,user): raise HTTPException(403,'Final result entry is not assigned to this role')
        year,_,_=aw.roster(data,body.academic_year_code,body.program_code)
        roster=academic_roster(data,year,user)
        item=next((s for s in curriculum(data,body.program_code,body.academic_year_code)['items'] if s['subject_code']==body.subject_code and s['semester_number']==body.semester_number),None)
        if not item: raise HTTPException(422,'Select a subject in this course semester')
        if aw.teaching(user) and body.subject_code not in {o['subject_code'] for o in aw.rows(data,'subject_offerings') if o['teacher_code'] in aw.teacher_codes(data,user)}: raise HTTPException(403,'This subject is outside your teaching allocation')
        if body.assessed_on>local_now().date() or body.pass_marks>body.max_marks: raise HTTPException(422,'Check the assessment date and passing marks')
        students={s.student_code for s in body.students}
        if len(students)!=len(body.students) or students-set(roster): raise HTTPException(422,'Choose eligible students once each')
        year=data['records']['academic_years'][body.academic_year_code]
        term=next((s for s in calendar(data,year) if s['semester_number']==body.semester_number),None)
        if term and body.assessed_on.isoformat()<str(term['start_date'])[:10]: raise HTTPException(422,'Results cannot predate the semester')
        if aw.teaching(user):
            allowed_sections={o['section_code'] for o in aw.rows(data,'subject_offerings') if o['subject_code']==body.subject_code and o['teacher_code'] in aw.teacher_codes(data,user)}
            eligible={e['student_code'] for e in aw.rows(data,'student_enrollments') if e['section_code'] in allowed_sections and e.get('status') in {'active','completed'}}
            if students-eligible: raise HTTPException(403,'A student is outside your subject allocation')
        key=result_key(body.academic_year_code,body.semester_number,body.subject_code,body.attempt)
        revisions=data.setdefault('documents',{}).setdefault('semester_result_revisions',{})
        if revision_value(revisions.get(key))!=body.revision: raise HTTPException(409,'Results changed; refresh before saving')
        for row in body.students:
            if row.marks is not None and (row.marks>body.max_marks or row.absent): raise HTTPException(422,'Marks exceed maximum or conflict with absence')
            code='SRES-'+hashlib.sha256((key+':'+row.student_code).encode()).hexdigest()[:32]
            results(data)[code]={'code':code,**body.model_dump(mode='json',exclude={'students','revision'}),**row.model_dump(mode='json'),'updated_at':now(),'updated_by':user['code']}
        notices=[]
        if body.published:
            from .certificate_workspace import personal_accounts
            for student in students:
                for account in personal_accounts(data,student):
                    notice=new_code('SNOTICE')
                    data['records'].setdefault('notifications',{})[notice]={'code':notice,'user_code':account,'title':f'Semester {body.semester_number} result published','body':'A final subject result is available in Academic progress.','screen':'results','academic_year_code':body.academic_year_code,'semester_number':body.semester_number,'channel':'in_app','status':'sent','sent_at':now()}
                    notices.append(notice)
        revisions[key]={'revision':body.revision+1}
        audit(data,user['code'],'semester_results_save','exam_results',key)
    from .certificate_workspace import push
    background.add_task(push,request,notices)
    return {'revision':body.revision+1,'saved':len(body.students)}


def result_key(year,semester,subject,attempt):
    return 'SGR-'+hashlib.sha256(f'{year}|{semester}|{subject}|{attempt}'.encode()).hexdigest()[:32]


class CalendarTerm(StrictModel):
    semester_number:int=Field(ge=1,le=16)
    start_date:date
    end_date:date
class CalendarInput(StrictModel):
    revision:int=Field(ge=0)
    academic_year_code:str
    program_code:str
    semesters:list[CalendarTerm]=Field(min_length=1,max_length=16)


@router.put('/calendar')
def save_calendar(body:CalendarInput,request:Request,user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if not has_permission(data,user,'academic_years','edit'): raise HTTPException(403,'Academic calendar editing is not assigned to this role')
        year,_,_=aw.roster(data,body.academic_year_code,body.program_code)
        count=int(data['records']['programs'][body.program_code]['duration_semesters'])
        terms=sorted(body.semesters,key=lambda s:s.semester_number)
        if [s.semester_number for s in terms]!=list(range(1,count+1)): raise HTTPException(422,'Provide each course semester once')
        for i,term in enumerate(terms):
            if term.start_date>term.end_date or term.start_date.isoformat()<str(year['start_date'])[:10] or term.end_date.isoformat()>str(year['end_date'])[:10] or i and term.start_date<=terms[i-1].end_date: raise HTTPException(422,'Semester dates must be ordered, non-overlapping and within the batch')
        versions=data.setdefault('documents',{}).setdefault('semester_calendar_revisions',{})
        if revision_value(versions.get(year['code']))!=body.revision: raise HTTPException(409,'Calendar changed; refresh before saving')
        existing={s['semester_number']:s for s in aw.rows(data,'semesters') if s['academic_year_code']==year['code']}
        for term in terms:
            record={**existing.get(term.semester_number,{}),**term.model_dump(mode='json'),'academic_year_code':year['code']}
            record['code']=record.get('code') or new_code('SEM')
            record['name']=record.get('name') or f'Semester {term.semester_number}'
            data['records'].setdefault('semesters',{})[record['code']]=record
        versions[year['code']]={'revision':body.revision+1}
        data['documents'].setdefault('semester_calendar_reviewed',{})[year['code']]={'reviewed':True}
        audit(data,user['code'],'semester_calendar_save','academic_years',year['code'])
        return {'revision':body.revision+1,**semester_state(data,year)}


def academic_roster(data,year,user):
    _,sections,_=aw.roster(data,year['code'],year['program_code'])
    if aw.teaching(user):
        sections &= {o['section_code'] for o in aw.rows(data,'subject_offerings') if o['teacher_code'] in aw.teacher_codes(data,user)}
    members={e['student_code'] for e in aw.rows(data,'student_enrollments') if e['section_code'] in sections and e.get('status') in {'active','completed'}}
    if not aw.teaching(user):
        members.update(p['student_code'] for p in aw.rows(data,'student_admission_profiles') if p.get('program_code')==year['program_code'] and p.get('academic_year_code')==year['code'])
    return {s['code']:s for s in aw.rows(data,'students') if s['code'] in members}


def due_reminders(data):
    """Deduplicated in-app notices: seven days before, due day, then weekly overdue."""
    from .certificate_workspace import personal_accounts
    student_codes={r['student_code'] for r in aw.rows(data,'student_fee_charges')}
    made=[];sent=data.setdefault('documents',{}).setdefault('semester_fee_reminders',{})
    for charge in fee_progress(data,student_codes):
        if Decimal(charge['outstanding'])<=0 or not charge.get('due_date'):continue
        remaining=(date.fromisoformat(str(charge['due_date'])[:10])-local_now().date()).days
        if remaining>7:continue
        stage='upcoming' if remaining>0 else 'due' if remaining==0 else f'overdue-{(-remaining-1)//7}'
        for account in personal_accounts(data,charge['student_code']):
            key='FREM-'+hashlib.sha256(f"{charge['code']}|{charge['due_date']}|{account}|{stage}".encode()).hexdigest()[:32]
            if key in sent:continue
            term=f"Semester {charge['semester_number']}" if charge.get('semester_number') else 'College'
            code=new_code('FNOTICE')
            data['records'].setdefault('notifications',{})[code]={'code':code,'user_code':account,'title':term+' fee reminder','body':f"{charge['fee_head']}: INR {charge['outstanding']} remains due on {charge['due_date']}. Open Fees to review payments.",'screen':'fees','charge_code':charge['code'],'academic_year_code':charge['academic_year_code'],'semester_number':charge.get('semester_number'),'channel':'in_app','status':'sent','sent_at':now()}
            sent[key]={'notification_code':code,'created_at':now()};made.append(code)
    return made


@router.post('/fee-reminders/run')
def run_fee_reminders(request:Request,background:BackgroundTasks,user=Depends(current_user)):
    if not has_permission(request.app.state.store.snapshot(),user,'student_fee_charges','create'):raise HTTPException(403,'Fee administration permission required')
    with request.app.state.store.transaction() as data:
        notices=due_reminders(data)
        audit(data,user['code'],'semester_fee_reminders','notifications',str(len(notices)))
    from .certificate_workspace import push
    background.add_task(push,request,notices)
    return {'created':len(notices)}
