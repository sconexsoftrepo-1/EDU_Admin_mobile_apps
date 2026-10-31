"""Create linked, identifiable demo academics without replacing existing college records.

Run --apply only after a dry run. --sql-host overrides the local Windows-style SQL address.
All newly created demo accounts use EDUNEXA_DEMO_PASSWORD (default requested test@123).
Existing accounts and their passwords are never changed.
"""
import argparse
import copy
from datetime import date,datetime,timedelta
import hashlib
import os
from pathlib import Path
import random
import sys
from zoneinfo import ZoneInfo
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.core.security import hasher
from app.core.resources import CATALOG,validate_record,ensure_references
from app.core.storage import audit,now
from app.core.settings import Settings
from app.core.curriculum_workspace import curriculum
from app.core.academic_progress import result_key
from create_master_data_role import store_for

RUN='linked-academics-2026-v1'
PREFIX='D26-'
FIRST=['Aadhya','Nisha','Pranav','Vihaan','Ananya','Kavya','Arjun','Ishaan','Saanvi','Rohan','Meera','Aditya','Tara','Neel','Diya','Kiran','Sahana','Varun','Anika','Dev']
LAST=['Rao','Iyer','Reddy','Varma','Sharma','Nair','Menon','Joshi','Naidu','Patel','Kulkarni','Das']
RESOURCES=['programs','academic_years','batches','semesters','subjects','curriculum_subjects','subject_offerings','timetable_slots','rooms','students','parents','student_parents','student_enrollments','student_subjects','employees','teachers','exam_results','exams','exam_papers','student_attendance','attendance_sessions','fee_heads','fee_structures','student_fee_charges','payments','payment_allocations','receipts','notifications','assignments','certificates','certificate_types','certificate_requests','learning_resources','calendar_events','departments','campuses','institution_settings']
TABLES=['programs','departments','campuses','institutions','semesters','academic_years','batches','sections','subjects','curriculum_subjects','employees','teachers','rooms','students','parents','student_parents','student_enrollments','student_subjects','subject_offerings','timetable_slots','fee_heads','fee_structures','student_fee_charges','payments','payment_allocations','receipts','notifications']


def ensure_demo_timetables(data):
    records=data['records'];templates=data.setdefault('documents',{}).setdefault('timetables',{})
    sections={r['code']:r for r in records.get('sections',{}).values() if r['code'].startswith(PREFIX)}
    terms={r['code']:r for r in records.get('semesters',{}).values()}
    offerings={r['code']:r for r in records.get('subject_offerings',{}).values() if r['section_code'] in sections}
    teachers={r['code']:r for r in records.get('teachers',{}).values()};employees={r['code']:r for r in records.get('employees',{}).values()}
    subjects={r['code']:r for r in records.get('subjects',{}).values()};rooms={r['code']:r for r in records.get('rooms',{}).values()}
    slots=[r for r in records.get('timetable_slots',{}).values() if r['offering_code'] in offerings]
    made=0
    for section in sections.values():
        code='DEMO-TT-'+section['code']
        if code in templates:continue
        term=terms.get(section.get('semester_code'),{});batch=records['batches'][section['batch_code']];program=records['programs'][batch['program_code']]
        selected=[r for r in slots if offerings[r['offering_code']]['section_code']==section['code']]
        starts=sorted({str(r['start_time'])[:5] for r in selected})
        if not starts:continue
        periods=[{'start':a,'end':str(next(r['end_time'] for r in selected if str(r['start_time'])[:5]==a))[:5],'kind':'teaching','label':f'Period {i+1}'} for i,a in enumerate(starts)]
        cells=[]
        for slot in selected:
            offering=offerings[slot['offering_code']];subject=subjects[offering['subject_code']];person=employees.get(teachers.get(offering['teacher_code'],{}).get('employee_code'),{})
            cells.append({'day':int(slot['weekday'])-1,'row':starts.index(str(slot['start_time'])[:5]),'span':1,'kind':'lab' if subject.get('subject_type')=='practical' else 'theory','title':subject['name'],'subject_code':subject['code'],'faculty':' '.join(str(person.get(k) or '') for k in ('first_name','last_name')).strip(),'room':rooms.get(slot['room_code'],{}).get('name','')})
        templates[code]={'code':code,'name':f"{program['name']} · {batch['entry_year']} · Semester {term['semester_number']} · Demo",'template':program['course_level'],'program_code':program['code'],'batch_code':batch['code'],'study_year':(term['semester_number']+1)//2,'semester':term['semester_number'],'section':section['name'],'coordinator':'','status':'Published','revision':1,'periods':periods,'cells':cells,'created_at':now(),'updated_at':now(),'created_by':PREFIX+'ADMIN','demo_run':RUN};made+=1
    return made


def populate(data,password):
    registry=data.setdefault('documents',{}).setdefault('academic_demo_runs',{})
    if RUN in registry:
        ensure_demo_timetables(data)
        return registry[RUN],False
    rng=random.Random(20261031)
    for table in TABLES:list(data['records'].get(table,{}).values())
    list(data['accounts'].values());list(data['roles'].values())
    existing_logins={a['login_id'].casefold() for a in data['accounts'].values()}
    if any(code.startswith(PREFIX) for table in TABLES for code in data['records'].get(table,{})):
        raise ValueError('Demo prefix already exists without a run registry; review it before seeding')
    def put(table,code,**values):
        fields={f['name'] for f in CATALOG[table]['fields']}
        row=validate_record(table,{'code':code,**{k:v for k,v in values.items() if k in fields}})
        row.update({k:v for k,v in values.items() if k not in fields},demo_run=RUN)
        ensure_references(data,table,row)
        data['records'].setdefault(table,{})[code]=row
        return row
    credentials=[]
    def account(code,login,role,kind,person,name,details):
        if login.casefold() in existing_logins:raise ValueError('A requested demo login already exists; existing accounts are never replaced')
        clients=['admin-web',{'employee':'teacher-mobile' if role==PREFIX+'TEACH' else 'admin-mobile','student':'student-mobile','parent':'parent-mobile'}[kind]]
        data['accounts'][code]={'code':code,'login_id':login,'password_hash':hasher.hash(password),'active':True,'person_type':kind,'person_code':person,'role_codes':[role],'clients':clients,'demo_run':RUN}
        existing_logins.add(login.casefold())
        credentials.append({'login':login,'name':name,'role':role,'person_code':person,**details})
        return code
    for suffix,name,scope in [('ADMIN','Demo Academic Administrator','college'),('TEACH','Demo Faculty','teaching'),('STUDENT','Demo Student','self'),('PARENT','Demo Parent','self')]:
        data['roles'][PREFIX+suffix]={'code':PREFIX+suffix,'name':name,'scope':scope,'system_admin':False,'permissions':{r:['view','create','edit','export','approve'] for r in RESOURCES} if scope=='college' else {},'demo_run':RUN}
    programs=list(data['records']['programs'].values())
    specs=[('Intermediate BPC',2026),('Intermediate MPC',2025),('BCA',2024),('B.Com General',2025)]
    selected=[]
    for name,entry in specs:
        matches=[p for p in programs if p['name'].casefold()==name.casefold()]
        if len(matches)!=1:raise ValueError('Expected one registered course named '+name)
        selected.append((matches[0],entry))
    first_program=selected[0][0];department=data['records']['departments'][first_program['department_code']];campus=data['records']['campuses'][department['campus_code']]
    admin=put('employees',PREFIX+'ADMIN-EMP',campus_code=campus['code'],department_code=department['code'],first_name='Sahana',last_name='Rao',employee_type='staff',designation='Academic Administrator',join_date='2024-06-01',employment_type='permanent',status='active',email='demo.admin@example.invalid')
    admin_account=account(PREFIX+'ADMIN','demo.admin',PREFIX+'ADMIN','employee',admin['code'],'Sahana Rao',{'description':'Academic administration, analytics, faculty allocation and demo collections'})
    fee_head=put('fee_heads',PREFIX+'TUITION',name='Demo semester tuition',description='Synthetic linked academic demonstration',collection_ownership='internal',scholarship_eligible=True,category='academic')
    today=datetime.now(ZoneInfo('Asia/Kolkata')).date()
    teacher_index=student_index=0;batches=[]
    first_teacher_account=None
    result_docs=data['documents'].setdefault('semester_results',{});result_versions=data['documents'].setdefault('semester_result_revisions',{})
    for cohort,(program,entry) in enumerate(selected,1):
        duration=int(program['duration_semesters']);end_year=entry+duration//2
        year_code=f'{PREFIX}AY{cohort}';batch_code=f'{PREFIX}B{cohort}'
        put('academic_years',year_code,program_code=program['code'],name=f'{program["name"]} · Demo {entry}–{end_year}',start_date=f'{entry}-06-01',end_date=f'{end_year}-05-31',batch_code=batch_code)
        put('batches',batch_code,program_code=program['code'],academic_year_code=year_code,name=f'Demo {entry}–{end_year}',entry_year=entry,graduation_year=end_year)
        plan=copy.deepcopy(curriculum(data,program['code']))
        data['documents'].setdefault('academic_batch_curricula',{})[year_code]={**plan,'academic_year_code':year_code}
        terms=[];sections={};offerings={};teacher_pool={}
        dep=data['records']['departments'][program['department_code']];campus_code=dep['campus_code']
        for n in range(1,duration+1):
            start=date(entry+(n-1)//2,6 if n%2 else 12,1)
            end=date(start.year,11,30) if n%2 else date(start.year+1,5,31)
            term=put('semesters',f'{PREFIX}SEM{cohort}-{n}',academic_year_code=year_code,semester_number=n,name=f'Semester {n}',start_date=start.isoformat(),end_date=end.isoformat())
            terms.append(term)
            section=put('sections',f'{PREFIX}SEC{cohort}-{n}',batch_code=batch_code,semester_code=term['code'],name=f'A · S{n}',capacity=30);sections[n]=section
            classroom=put('rooms',f'{PREFIX}ROOM{cohort}-{n}',campus_code=campus_code,name=f'Demo {program["name"]} S{n}',room_type='classroom',capacity=30)
            labs=put('rooms',f'{PREFIX}LAB{cohort}-{n}',campus_code=campus_code,name=f'Demo lab {cohort} S{n}',room_type='laboratory',capacity=30)
            subjects=[s for s in plan['items'] if s['semester_number']==n]
            for j,subject in enumerate(subjects):
                if j not in teacher_pool:
                    teacher_index+=1;first,last=rng.choice(FIRST),rng.choice(LAST);emp_code=f'{PREFIX}EMP{teacher_index:02d}';teacher_code=f'{PREFIX}T{teacher_index:02d}'
                    put('employees',emp_code,campus_code=campus_code,department_code=dep['code'],first_name=first,last_name=last,employee_type='teacher',designation='Lecturer',email=f'demo.teacher{teacher_index:02d}@example.invalid',join_date='2023-06-01',employment_type='permanent',status='active')
                    put('teachers',teacher_code,employee_code=emp_code,qualification='Postgraduate',specialization=subject['name'],experience_years=5)
                    login=account(f'{PREFIX}TA{teacher_index:02d}',f'demo.teacher{teacher_index:02d}',PREFIX+'TEACH','employee',emp_code,f'{first} {last}',{'course':program['name'],'subjects':[],'description':'Faculty allocation, timetable, attendance and results'})
                    first_teacher_account=first_teacher_account or login
                    teacher_pool[j]=(teacher_code,login)
                teacher_code,login=teacher_pool[j]
                person=next(c for c in credentials if c['person_code']==data['records']['teachers'][teacher_code]['employee_code'])
                person['subjects'].append(f'S{n}: {subject["name"]}')
                offering=put('subject_offerings',f'{PREFIX}O{cohort}-{n}-{j}',subject_code=subject['subject_code'],section_code=section['code'],teacher_code=teacher_code)
                offerings[(n,j)]=offering
            periods=[('09:00:00','09:50:00'),('10:00:00','10:50:00'),('11:10:00','12:00:00'),('13:00:00','13:50:00'),('14:00:00','14:50:00')]
            for weekday in range(1,7):
                for p,(a,b) in enumerate(periods):
                    j=0 if p==0 else 1+((weekday-1)*4+p-1)%max(1,len(subjects)-1)
                    offering=offerings[(n,j)];subject=subjects[j]
                    put('timetable_slots',f'{PREFIX}SLOT{cohort}-{n}-{weekday}-{p}',offering_code=offering['code'],room_code=labs['code'] if subject['subject_type']=='practical' else classroom['code'],weekday=weekday,start_time=a,end_time=b)
        data['documents'].setdefault('semester_calendar_reviewed',{})[year_code]={'reviewed':True}
        current=next((t['semester_number'] for t in terms if t['start_date']<=today.isoformat()<=t['end_date']),1)
        batch_students=[]
        for i in range(12):
            student_index+=1;idx=student_index;first,last=rng.choice(FIRST),rng.choice(LAST);parent_first=rng.choice(FIRST);student=f'{PREFIX}ST{idx:02d}';parent=f'{PREFIX}PAR{idx:02d}';phone=f'+120255501{idx:02d}'
            put('parents',parent,first_name=parent_first,last_name=last,email=f'demo.parent{idx:02d}@example.invalid',phone=phone,occupation='Demo professional',address='Synthetic demo address',city='Hyderabad',state='Telangana',postal_code='500001')
            put('students',student,campus_code=campus_code,admission_number=f'DEMO-{entry}-{idx:03d}',first_name=first,last_name=last,date_of_birth=f'{entry-17}-04-{i+1:02d}',gender='female' if i%2==0 else 'male',email=f'demo.student{idx:02d}@example.invalid',admission_date=f'{entry}-06-01',address='Synthetic demo address',city='Hyderabad',state='Telangana',postal_code='500001',country='India',emergency_contact_name=f'{parent_first} {last}',emergency_contact_phone=phone,status='active',current_year=(current+1)//2)
            put('student_parents',f'{PREFIX}F{idx:02d}',student_code=student,parent_code=parent,relationship='guardian',is_primary=True,can_pickup=True,receives_notifications=True)
            student_account=account(f'{PREFIX}SA{idx:02d}',f'demo.student{idx:02d}',PREFIX+'STUDENT','student',student,f'{first} {last}',{'course':program['name'],'batch':f'{entry}–{end_year}','current_semester':current,'parent_login':f'demo.parent{idx:02d}'})
            parent_account=account(f'{PREFIX}PA{idx:02d}',f'demo.parent{idx:02d}',PREFIX+'PARENT','parent',parent,f'{parent_first} {last}',{'student_login':f'demo.student{idx:02d}','child':f'{first} {last}','course':program['name'],'batch':f'{entry}–{end_year}'})
            batch_students.append((student,student_account,parent_account))
            for n in range(1,current+1):
                enrollment=put('student_enrollments',f'{PREFIX}EN{idx:02d}-{n}',student_code=student,section_code=sections[n]['code'],roll_number=f'{cohort}{idx:03d}',enrolled_on=terms[n-1]['start_date'],status='active' if n==current else 'completed')
                for (term,j),offering in offerings.items():
                    if term==n:put('student_subjects',f'{PREFIX}SS{idx:02d}-{n}-{j}',enrollment_code=enrollment['code'],offering_code=offering['code'])
            for n in range(1,duration+1):
                structure_code=f'{PREFIX}FEE{cohort}-{n}'
                if structure_code not in data['records'].setdefault('fee_structures',{}):
                    due=(today+timedelta(days=5)).isoformat() if n==current else (date.fromisoformat(terms[n-1]['start_date'])+timedelta(days=14)).isoformat()
                    put('fee_structures',structure_code,program_code=program['code'],academic_year_code=year_code,fee_head_code=fee_head['code'],semester_number=n,amount='15000.00',due_date=due,currency='INR',installment_number=1,billing_frequency='semester',fee_basis='semester',approval_reference='Identifiable demo dataset')
                due=data['records']['fee_structures'][structure_code]['due_date']
                charge=put('student_fee_charges',f'{PREFIX}CH{idx:02d}-{n}',student_code=student,fee_structure_code=structure_code,amount='15000.00',due_date=due,tax_amount='0',semester_number=n,academic_year_code=year_code)
                amount='15000.00' if n<current else '7500.00' if n==current and i%3 else None
                if amount:
                    payment=put('payments',f'{PREFIX}PAY{idx:02d}-{n}',student_code=student,amount=amount,currency='INR',paid_on=min(today,date.fromisoformat(due)).isoformat(),method='bank_transfer',transaction_reference=f'DEMO-TXN-{idx}-{n}',status='settled')
                    put('payment_allocations',f'{PREFIX}ALLOC{idx:02d}-{n}',payment_code=payment['code'],charge_code=charge['code'],amount=amount)
                if n==current:
                    for account_code in (student_account,parent_account):
                        put('notifications',f'{PREFIX}FNOTICE{idx:02d}-{account_code}',user_code=account_code,title='Semester fee reminder',body=f'Semester {n} demo tuition is due on {due}. View the actual balance in Fees.',channel='in_app',status='sent',sent_at=now(),screen='fees',charge_code=charge['code'])
            for subject in plan['items']:
                n=subject['semester_number']
                if n>=current:continue
                failed=(i+int(hashlib.sha256(subject['subject_code'].encode()).hexdigest()[:3],16))%9==0
                mark=28 if failed else 55+(i*7+n*3)%43
                group=result_key(year_code,n,subject['subject_code'],1);key='SRES-'+hashlib.sha256((group+':'+student).encode()).hexdigest()[:32]
                result_docs[key]={'code':key,'program_code':program['code'],'academic_year_code':year_code,'semester_number':n,'subject_code':subject['subject_code'],'student_code':student,'marks':str(mark),'max_marks':'100','pass_marks':'40','absent':False,'attempt':1,'published':True,'assessed_on':terms[n-1]['end_date'],'updated_at':now(),'updated_by':admin_account,'demo_run':RUN};result_versions[group]={'revision':1}
                if failed and i%2==0:
                    group2=result_key(year_code,n,subject['subject_code'],2);key2='SRES-'+hashlib.sha256((group2+':'+student).encode()).hexdigest()[:32]
                    result_docs[key2]={**result_docs[key],'code':key2,'marks':'62','attempt':2,'assessed_on':(today-timedelta(days=3)).isoformat()};result_versions[group2]={'revision':1}
        # Attendance is persisted in the same shared register API storage used by all clients.
        registers=data['documents'].setdefault('attendance_registers',{})
        current_subjects=[s for s in plan['items'] if s['semester_number']==current]
        for offset in range(1,19):
            day=today-timedelta(days=offset)
            if day.isoweekday()==7:continue
            for period in range(1,6):
                j=0 if period==1 else 1+((day.isoweekday()-1)*4+period-2)%max(1,len(current_subjects)-1)
                subject=current_subjects[j];key=f'{PREFIX}ATT{cohort}-{day.isoformat()}-{period}'
                registers[key]={'code':key,'program_code':program['code'],'academic_year_code':year_code,'section_code':sections[current]['code'],'session_date':day.isoformat(),'period':period,'semester_number':current,'subject_code':subject['subject_code'],'subject':subject['name'],'revision':1,'marks':{s:'absent' if (i+offset+period)%13==0 else 'late' if (i+offset)%17==0 else 'present' for i,(s,_,_) in enumerate(batch_students)},'updated_at':now(),'updated_by':admin_account,'demo_run':RUN}
        # Published learning work and a completed assessment supply real list/detail data.
        recipient=[s for s,_,_ in batch_students];subject=current_subjects[0];teacher=offerings[(current,0)]['teacher_code']
        for completed in (False,True):
            suffix='DONE' if completed else 'NEXT';instant=datetime.now(ZoneInfo('Asia/Kolkata'))+timedelta(days=-2 if completed else 4)
            assess_code=f'{PREFIX}ASSESS{cohort}-{suffix}'
            data['documents'].setdefault('assessments',{})[assess_code]={'code':assess_code,'title':f'{subject["name"]} · Demo {"review" if completed else "assessment"}','description':'Review the selected semester subject concepts and answer the assigned questions. This is synthetic demonstration content.','guidance':'Read the lesson notes and bring the required stationery.','course_level':program['course_level'],'program_code':program['code'],'academic_year_code':year_code,'section_code':sections[current]['code'],'teacher_code':teacher,'subject_code':subject['subject_code'],'semester_number':current,'scheduled_at':instant.isoformat(),'max_marks':'50','status':'published','attachments':[],'revision':1,'recipient_student_codes':recipient,'marks':{s:{'student_code':s,'marks':str(28+i%20),'absent':False,'feedback':'Demo feedback: review the highlighted concepts.','reviewed_at':now(),'reviewed_by':admin_account} for i,s in enumerate(recipient)} if completed else {},'created_at':now(),'created_by':admin_account,'demo_run':RUN}
            assignment=f'{PREFIX}ASG{cohort}-{suffix}'
            data['documents'].setdefault('assignment_records',{})[assignment]={'code':assignment,'title':f'{subject["name"]} · Demo practice','description':'Complete a short revision worksheet for the current semester subject. Synthetic demonstration work.','course_level':program['course_level'],'program_code':program['code'],'academic_year_code':year_code,'section_code':sections[current]['code'],'teacher_code':teacher,'subject_code':subject['subject_code'],'semester_number':current,'due_at':instant.isoformat(),'max_marks':'20','allow_late':True,'attachments':[],'revision':1,'recipient_student_codes':recipient,'created_at':now(),'created_by':admin_account,'demo_run':RUN}
            if completed:
                for i,s in enumerate(recipient):
                    key=f'{PREFIX}SUB{cohort}-{s}'
                    data['documents'].setdefault('assignment_submissions',{})[key]={'code':key,'assignment_code':assignment,'student_code':s,'completed':True,'marks':str(12+i%8),'feedback':'Completed demo revision.','revision':1,'attachments':[],'submitted_at':instant.isoformat(),'reviewed_at':now(),'reviewed_by':admin_account}
        batches.append({'code':year_code,'program_code':program['code'],'course':program['name'],'current_semester':current,'students':len(recipient),'section_code':sections[current]['code']})
    result={'run':RUN,'created_at':now(),'batches':batches,'credentials':credentials,'counts':{'students':student_index,'parents':student_index,'teachers':teacher_index,'accounts':len(credentials)},'demo_only':True}
    ensure_demo_timetables(data)
    registry[RUN]=result
    audit(data,None,'linked_academic_demo_seed','academic_years',RUN)
    return result,True


def write_logins(result,password,path):
    lines=['PRAGATHI COLLEGE — LINKED ACADEMIC DEMO LOGINS','Synthetic demo identities only. Existing college accounts were not changed.',f'Password for every login below: {password}','API: http://150.241.246.34:8010','',f'Dataset: {result["run"]}']
    for b in result['batches']:lines.append(f'{b["course"]}: {b["code"]}, current semester {b["current_semester"]}, {b["students"]} students')
    for item in result['credentials']:
        lines+=['','LOGIN: '+item['login'],'Name: '+item['name'],'Role: '+item['role'],'Record: '+item['person_code']]
        lines += [f'{key.replace("_"," ").title()}: '+(', '.join(value) if isinstance(value,list) else str(value)) for key,value in item.items() if key not in {'login','name','role','person_code'}]
    target=Path(path);temp=target.with_suffix('.new.txt')
    temp.write_text('\n'.join(lines)+'\n');os.chmod(temp,0o600);os.replace(temp,target)


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--apply',action='store_true');p.add_argument('--sql-host');p.add_argument('--logins',default=str(Path(__file__).resolve().parents[2]/'mock_logins.txt'));args=p.parse_args()
    settings=Settings()
    if args.sql_host:
        from app.core.sqlserver import SqlServerSettings,SqlServerStore
        store=SqlServerStore(SqlServerSettings(host=args.sql_host,query_timeout=300))
    else:store=store_for(settings)
    password=os.environ.get('EDUNEXA_DEMO_PASSWORD','test@123')
    try:
        if not args.apply:
            d=store.snapshot();existing=d.get('documents',{}).get('academic_demo_runs',{}).get(RUN)
            print('Dataset already present; rerun --apply only rewrites its login report.' if existing else 'Would create 4 linked demo batches, 48 students, 48 parents, subject faculty, timetables, attendance, results and fees. No existing accounts will be changed.')
            return
        with store.transaction() as data:result,created=populate(data,password)
        write_logins(result,password,args.logins)
        print('Created dataset.' if created else 'Dataset already present; records preserved.')
        print(result['counts']);print('Login report written:',args.logins)
    finally:
        if hasattr(store,'close'):store.close()
if __name__=='__main__':main()
