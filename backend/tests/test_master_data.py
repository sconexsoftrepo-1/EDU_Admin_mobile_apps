import importlib.util
from pathlib import Path

from app.core.security import hasher

TOOL = Path(__file__).resolve().parents[1] / "tools" / "create_master_data_role.py"
spec = importlib.util.spec_from_file_location("create_master_data_role", TOOL)
role_tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(role_tool)

PASSWORD = "Strong-Entry-Password-245!"


def master_data_user(app, client):
    with app.state.store.transaction() as d:
        d["roles"][role_tool.ROLE_CODE] = {
            "code": role_tool.ROLE_CODE, "name": "Master Data Entry", "scope": "college",
            "system_admin": False, "permissions": role_tool.PERMISSIONS,
            "screens": role_tool.SCREENS, "import_files": role_tool.IMPORT_FILES,
        }
        d["accounts"]["MDE"] = {
            "code": "MDE", "login_id": "entry.operator", "password_hash": hasher.hash(PASSWORD),
            "active": True, "person_type": "system", "person_code": "master-data-entry",
            "role_codes": [role_tool.ROLE_CODE], "clients": ["admin-web"],
        }
    with app.state.store.transaction() as d:
        records = d["records"]
        records.setdefault("institutions", {})["INST"] = {"code": "INST", "name": "College"}
        records.setdefault("campuses", {})["CAMP"] = {"code": "CAMP", "institution_code": "INST", "name": "Main"}
        records.setdefault("departments", {})["DEP"] = {"code": "DEP", "campus_code": "CAMP", "name": "Science"}
        records.setdefault("academic_years", {})["AY"] = {"code": "AY", "name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-05-31"}
        records.setdefault("semesters", {})["SEM1"] = {"code": "SEM1", "academic_year_code": "AY", "name": "Semester 1",
                                        "semester_number": 1, "start_date": "2026-06-01", "end_date": "2026-11-30"}
    token = client.post("/api/v1/auth/login", json={"login_id": "entry.operator", "password": PASSWORD,
                                                    "client": "admin-web"}).json()["access_token"]
    return {"Authorization": "Bearer " + token}


EMPLOYEE = {"campus_code": "CAMP", "department_code": "DEP", "first_name": "Asha", "last_name": "Rao",
            "designation": "Lecturer", "email": "asha.rao@example.edu", "phone": "9876500001",
            "join_date": "2026-06-01", "employment_type": "permanent", "status": "active"}
STUDENT = {"campus_code": "CAMP", "admission_number": "ADM-001", "first_name": "Kiran", "last_name": "Patel",
           "date_of_birth": "2008-04-12", "gender": "male", "admission_date": "2026-06-10",
           "address": "12 MG Road", "city": "Hyderabad", "state": "Telangana", "postal_code": "500001",
           "country": "India", "emergency_contact_name": "Meena Patel", "emergency_contact_phone": "9876500002",
           "status": "active"}


def test_role_sees_only_master_data_screens(client, app):
    h = master_data_user(app, client)
    keys = {s["key"] for s in client.get("/api/v1/workspace/screens", headers=h).json()["screens"]}
    assert keys == set(role_tool.SCREENS)
    assert client.get("/api/v1/workspace/screens/payments", headers=h).status_code == 403
    assert client.get("/api/v1/workspace/screens/teaching-staff", headers=h).status_code == 200
    files = [f["file"] for f in client.get("/api/v1/imports/excel/contract", headers=h).json()["files"]]
    assert files == role_tool.IMPORT_FILES
    actions = {a["key"] for a in client.get("/api/v1/master-data/actions", headers=h).json()["actions"]}
    assert {"onboard-teaching-staff", "onboard-non-teaching-staff", "create-course", "enroll-student"} <= actions


def test_master_data_entry_flow(client, app):
    h = master_data_user(app, client)
    teaching = client.post("/api/v1/master-data/staff/teaching", headers=h, json={
        "employee": EMPLOYEE, "teacher": {"qualification": "M.Sc. Physics", "specialization": "Optics"}})
    assert teaching.status_code == 201, teaching.text
    assert teaching.json()["employee"]["employee_type"] == "teacher"

    staff = client.post("/api/v1/master-data/staff/non-teaching", headers=h, json={
        "employee": {**EMPLOYEE, "first_name": "Ravi", "email": "ravi@example.edu", "designation": "Accountant"},
        "staff_profile": {"responsibility": "Accounts office", "shift": "General"},
        "salary_components": [
            {"component": "Basic pay", "component_type": "earning", "amount": "25000.00"},
            {"component": "Provident fund", "component_type": "deduction", "amount": "1800.00"},
        ]})
    assert staff.status_code == 201, staff.text
    assert [c["component"] for c in staff.json()["salary_components"]] == ["Basic pay", "Provident fund"]
    assert staff.json()["salary_components"][0]["effective_from"] == "2026-06-01"
    listed = client.get("/api/v1/master-data/staff?kind=non-teaching", headers=h).json()["items"]
    mine = [x for x in listed if x["employee"]["code"] == staff.json()["employee"]["code"]]
    assert len(mine) == 1 and len(mine[0]["salary_components"]) == 2

    course = client.post("/api/v1/master-data/courses", headers=h, json={
        "program": {"code": "BSC", "department_code": "DEP", "name": "B.Sc. Physics", "qualification": "B.Sc.",
                    "duration_semesters": 6},
        "batches": [{"code": "BSC-2026", "name": "2026-29", "entry_year": 2026, "graduation_year": 2029}]})
    assert course.status_code == 201, course.text
    batch = client.post("/api/v1/master-data/courses/BSC/batches", headers=h, json={
        "batch": {"code": "BSC-2027", "name": "2027-30", "entry_year": 2027, "graduation_year": 2030},
        "sections": [{"code": "BSC-2027-A", "semester_code": "SEM1", "name": "A", "capacity": 60}]})
    assert batch.status_code == 201, batch.text

    student = client.post("/api/v1/master-data/students", headers=h, json={
        "student": {**STUDENT, "code": "STU1"},
        "parents": [{"parent": {"first_name": "Meena", "last_name": "Patel", "phone": "9876500002"},
                     "relationship": "mother", "is_primary": True}]})
    assert student.status_code == 201, student.text
    more = client.post("/api/v1/master-data/students/STU1/parents", headers=h, json={
        "parents": [{"parent": {"first_name": "Suresh", "last_name": "Patel", "phone": "9876500003"},
                     "relationship": "father"}]})
    assert more.status_code == 201, more.text
    assert len(client.get("/api/v1/master-data/students/STU1/parents", headers=h).json()["items"]) == 2

    enrolled = client.post("/api/v1/master-data/course-enrollments", headers=h, json={
        "section_code": "BSC-2027-A", "students": [{"student_code": "STU1", "roll_number": "27BSC001"}]})
    assert enrolled.status_code == 201, enrolled.text
    summary = client.get("/api/v1/master-data/courses/BSC", headers=h).json()
    assert [s["enrolled"] for b in summary["batches"] for s in b["sections"]] == [1]

    form = client.post("/api/v1/master-data/admission-forms", headers=h, json={
        "application": {"program_code": "BSC", "academic_year_code": "AY", "first_name": "Nisha", "last_name": "Rao",
                        "email": "nisha@example.com", "phone": "9876500004", "address": "4 Park Street"},
        "guardians": [{"relationship": "father", "first_name": "Mohan", "last_name": "Rao", "phone": "9876500005"}],
        "qualifications": [{"qualification": "Intermediate (MPC)", "institution": "City Junior College",
                            "result_status": "passed"}]})
    assert form.status_code == 201, form.text
    assert form.json()["application"]["status"] == "submitted"
    assert form.json()["guardians"][0]["is_primary"] is True

    action = client.post("/api/v1/master-data/actions/onboard-teaching-staff", headers=h, json={"values": {
        **{f"employee.{k}": v for k, v in EMPLOYEE.items()}, "employee.email": "third@example.edu",
        "teacher.qualification": "M.A. English"}})
    assert action.status_code == 201, action.text


def test_master_data_requires_permissions(client, headers, app):
    # The protected administrator is unrestricted; an account without the role is not.
    assert client.get("/api/v1/master-data/actions", headers=headers).status_code == 200
    with app.state.store.transaction() as d:
        d["roles"]["VIEWER"] = {"code": "VIEWER", "name": "Viewer", "scope": "college", "system_admin": False,
                                "permissions": {"employees": ["view"]}}
        d["accounts"]["V"] = {"code": "V", "login_id": "viewer.only", "password_hash": hasher.hash(PASSWORD),
                              "active": True, "person_type": "system", "person_code": "viewer",
                              "role_codes": ["VIEWER"], "clients": ["admin-web"]}
    token = client.post("/api/v1/auth/login", json={"login_id": "viewer.only", "password": PASSWORD,
                                                    "client": "admin-web"}).json()["access_token"]
    response = client.post("/api/v1/master-data/staff/teaching", headers={"Authorization": "Bearer " + token},
                           json={"employee": EMPLOYEE, "teacher": {"qualification": "M.Sc."}})
    assert response.status_code == 403


def test_student_enrollment_form_with_one_guardian(client, app):
    h = master_data_user(app, client)
    form = next(a for a in client.get("/api/v1/master-data/actions", headers=h).json()["actions"]
                if a["key"] == "enroll-student")
    guardian = [f["key"] for f in form["fields"] if not f["key"].startswith("student.")]
    assert guardian == ["guardian.relationship", "guardian.first_name", "guardian.last_name", "guardian.phone",
                        "guardian.alternate_phone"]
    values = {**{f"student.{k}": v for k, v in STUDENT.items()}, "student.admission_number": "ADM-777",
              "guardian.relationship": "mother", "guardian.first_name": "Meena", "guardian.last_name": "Patel",
              "guardian.phone": "9876500012"}
    result = client.post("/api/v1/master-data/actions/enroll-student", headers=h, json={"values": values})
    assert result.status_code == 201, result.text
    [link] = result.json()["parents"]
    assert link["relationship"]["relationship"] == "mother" and link["relationship"]["is_primary"] is True
    assert link["parent"]["phone"] == "9876500012"
    # Guardian details are optional in this quick form: a student alone is enrolled too.
    alone = client.post("/api/v1/master-data/actions/enroll-student", headers=h, json={"values": {
        **{f"student.{k}": v for k, v in STUDENT.items()}, "student.admission_number": "ADM-778"}})
    assert alone.status_code == 201, alone.text
    assert alone.json()["parents"] == []


PDF = "JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDw+PgplbmRvYmoKdHJhaWxlcgo8PD4+CiUlRU9GCg=="  # tiny PDF


def wizard_student(**extra):
    return {
        "student": {"first_name": "Ravi", "last_name": "Kumar", "date_of_birth": "2009-05-01", "gender": "male",
                    "email": "ravi@example.com", "phone": "9876500100", "aadhaar_number": "123456789012",
                    "address": "1 Main Road", "city": "Hyderabad", "state": "Telangana", "postal_code": "500001",
                    "campus_code": "CAMP"},
        "last_qualification": {"level": "ssc", "institution": "City High School", "board": "SSC", "grade": "9.8"},
        "guardian": {"relationship": "father", "first_name": "Raju", "last_name": "Kumar", "phone": "9876500101",
                     "alternate_phone": "9876500102"},
        "documents": {"transfer_certificate": True, "study_conduct_certificate": False},
        "referral": {"name": "A. Teacher", "relation": "Staff member", "mobile": "9876500104"},
        "achievements": [{"title": "District science fair winner", "level": "district", "year": 2025}],
        "certifications": [{"name": "NCC 'A' certificate", "year": 2025}],
        "course": {"course_level": "intermediate", "program_code": "INT-MPC", "academic_year_code": "AY"},
        **extra,
    }


def test_enrollment_wizard_end_to_end(client, app):
    h = master_data_user(app, client)
    run = lambda key, values: client.post(f"/api/v1/master-data/actions/{key}", headers=h, json={"values": values})
    course = run("create-course", {"program.code": "INT-MPC", "program.department_code": "DEP",
                                   "program.name": "Intermediate MPC", "program.qualification": "Intermediate",
                                   "program.duration_semesters": 4, "program.course_level": "intermediate",
                                   "program.branch": "MPC"})
    assert course.status_code == 201, course.text
    year_code = "INT-MPC-2026-2028"
    for start, end in [(2026, 2028), (2027, 2029)]:
        made = client.post("/api/v1/workspace/resources/academic_years", headers=h, json={"values": {
            "program_code": "INT-MPC", "start_date": f"{start}-06-01", "end_date": f"{end}-05-31"}})
        assert made.status_code == 201, made.text
    fees = run("course-fee-structure", {"program_code": "INT-MPC", "academic_year_code": year_code, "year_of_study": 1,
                                        "due_date": "2026-07-15", "amount.tuition": "40000", "amount.exam": "2000",
                                        "amount.hostel": "60000", "amount.transport": "15000"})
    assert fees.status_code == 201, fees.text
    assert len(fees.json()["fee_structures"]) == 4

    options = client.get("/api/v1/master-data/enrollment/options?academic_year_code=INT-MPC-2026-2028&program_code=INT-MPC&hostel=true",
                         headers=h).json()
    assert [c["branch"] for c in options["courses"]["intermediate"]] == ["MPC"]
    assert options["admission_number"] == "26INTMPC0001"
    assert options["registration_number"] == "INT-MPC-2026-001"
    assert {f["category"] for f in options["fees"]} == {"academic", "hostel"}

    bad = client.post("/api/v1/master-data/enrollment", headers=h, json=wizard_student(
        course={"course_level": "intermediate", "program_code": "INT-MPC", "academic_year_code": year_code}, special_consideration={"amount": "500"}))
    assert bad.status_code == 422  # a special consideration needs a reason

    result = client.post("/api/v1/master-data/enrollment", headers=h, json=wizard_student(
        course={"course_level": "intermediate", "program_code": "INT-MPC", "academic_year_code": year_code},
        hostel_required=True, scholarship={"amount": "5000", "name": "Merit scholarship"},
        special_consideration={"amount": "1000", "reason": "Sibling studying in the college"}))
    assert result.status_code == 201, result.text
    body = result.json()
    student = body["student"]
    assert student["admission_number"] == "26INTMPC0001" and student["current_year"] == 1
    assert body["profile"]["registration_number"] == "INT-MPC-2026-001"
    assert body["profile"]["gross_fee"] == "102000.00" and body["profile"]["net_fee"] == "96000.00"
    assert [(p["relationship"]["relationship"], p["relationship"]["is_primary"]) for p in body["parents"]] == [("father", True)]
    # The master data user is not an employee: concessions wait for finance approval.
    assert {c["status"] for c in body["profile"]["fee_summary"] if c["category"] == "concession"} == {"pending_approval"}

    duplicate = client.post("/api/v1/master-data/enrollment", headers=h, json=wizard_student())
    assert duplicate.status_code == 409  # same Aadhaar number

    upload = client.post("/api/v1/documents/upload", headers=h, json={
        "kind": "student_document", "person_code": student["code"], "filename": "aadhaar.pdf",
        "content_base64": PDF, "document_label": "aadhaar_copy"})
    assert upload.status_code == 201, upload.text
    review = client.get(f"/api/v1/master-data/enrollment/{student['code']}", headers=h).json()
    assert review["profile"]["document_checklist"]["aadhaar_copy"]["uploaded"] is True
    assert review["profile"]["document_checklist"]["transfer_certificate"] == {
        "label": "TC (transfer certificate)", "submitted": True, "uploaded": False}
    assert review["program"]["branch"] == "MPC" and len(review["parents"]) == 1
    assert review["student"]["emergency_contact_phone"] == "9876500101"

    insights = client.get("/api/v1/master-data/enrollment/courses/INT-MPC/insights", headers=h).json()
    assert [b["code"] for b in insights["batches"]] == ["INT-MPC-2027-2029", "INT-MPC-2026-2028"]
    first = insights["batches"][1]
    assert first["students"] == 1 and first["hostel"] == 1 and first["net_fee"] == "96000.00"
    assert insights["totals"]["students"] == 1 and insights["totals"]["batches"] == 2 and insights["years"] == 2
    assert insights["semester_labels"] == ["1-1", "1-2", "2-1", "2-2"]

    assert run("promote-batch", {"batch_code": year_code, "to_year": 2}).status_code == 404
    assert body["batch"]["code"] == year_code


def test_create_course_registers_a_typed_department(client, app):
    h = master_data_user(app, client)
    form = next(a for a in client.get("/api/v1/master-data/actions", headers=h).json()["actions"]
                if a["key"] == "create-course")
    department = next(f for f in form["fields"] if f["key"] == "program.department_code")
    assert department["reference"] is None and department["type"] == "text"
    result = client.post("/api/v1/master-data/actions/create-course", headers=h, json={"values": {
        "program.code": "BSC-CS", "program.department_code": "Computer Science", "program.name": "B.Sc. Computers",
        "program.qualification": "B.Sc.", "program.duration_semesters": 6, "program.course_level": "degree",
        "program.branch": "Computer Science"}})
    assert result.status_code == 201, result.text
    code = result.json()["program"]["department_code"]
    assert code == "DEP-COMPUTER-SCIENCE"
    with app.state.store.transaction() as d:
        assert d["records"]["departments"][code]["name"] == "Computer Science"
        assert d["records"]["departments"][code]["campus_code"] == "CAMP"
    again = client.post("/api/v1/master-data/actions/create-course", headers=h, json={"values": {
        "program.code": "BSC-DS", "program.department_code": "computer science", "program.name": "B.Sc. Data Science",
        "program.qualification": "B.Sc.", "program.duration_semesters": 6}})
    assert again.status_code == 201 and again.json()["program"]["department_code"] == code  # reused


def test_course_catalog_seed_creates_campus_departments_and_courses(app, monkeypatch):
    import importlib.util as util

    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / "tools"))
    spec = util.spec_from_file_location("seed_course_catalog", Path(__file__).resolve().parents[1] / "tools/seed_course_catalog.py")
    seed = util.module_from_spec(spec)
    spec.loader.exec_module(seed)
    with app.state.store.transaction() as d:
        campus = seed.ensure_campus(d, "Pragathi", "Main Campus", "system")
        for department, values in seed.catalog():
            seed.create(d, "programs", {**values, "department_code": seed.ensure_department(d, department, campus, "system")},
                        "system")
    with app.state.store.transaction() as d:
        programs = d["records"]["programs"]
        assert d["records"]["institutions"]["INST-PRAGATHI"]["name"] == "Pragathi"
        assert programs["INT-MPC"]["branch"] == "MPC" and programs["INT-MPC"]["course_level"] == "intermediate"
        assert programs["DEG-BA-ENGLISH"]["qualification"] == "BA" and programs["DEG-BA-ENGLISH"]["branch"] == "English"
        assert programs["DEG-BA-LLB"]["duration_semesters"] == 10
        assert len([p for p in programs.values() if p["course_level"] == "degree"]) == 124
        assert len({p["department_code"] for p in programs.values()}) == 10


def test_batch_section_uses_first_semester_of_start_year(client, app):
    h = master_data_user(app, client)
    with app.state.store.transaction() as d:
        d["records"].setdefault("programs", {})["BSC-AUTO"] = {
            "code": "BSC-AUTO", "department_code": "DEP", "name": "B.Sc",
            "qualification": "B.Sc", "duration_semesters": 6,
        }
    result = client.post("/api/v1/master-data/courses/BSC-AUTO/batches", headers=h, json={
        "batch": {"name": "2026–2029", "entry_year": 2026, "graduation_year": 2029},
        "sections": [{"name": "A", "capacity": 60}],
    })
    assert result.status_code == 201, result.text
    assert result.json()["sections"][0]["semester_code"] == "SEM1"
    assert result.json()["batch"]["graduation_year"] == 2029


def test_batch_section_can_be_created_before_calendar_setup(client, app):
    h = master_data_user(app, client)
    with app.state.store.transaction() as d:
        d["records"].setdefault("programs", {})["BSC-AUTO"] = {
            "code": "BSC-AUTO", "department_code": "DEP", "name": "B.Sc",
            "qualification": "B.Sc", "duration_semesters": 6,
        }
    result = client.post("/api/v1/master-data/courses/BSC-AUTO/batches", headers=h, json={
        "batch": {"name": "2028–2031", "entry_year": 2028, "graduation_year": 2031},
        "sections": [{"name": "A"}],
    })
    assert result.status_code == 201, result.text
    assert result.json()["sections"][0].get("semester_code") is None
    assert result.json()["batch"]["entry_year"] == 2028


def test_course_insights_section_counts_deduplicate_active_enrollments(client, app):
    h = master_data_user(app, client)
    with app.state.store.transaction() as d:
        r = d['records']
        r.setdefault('programs', {})['COUNT-COURSE'] = {'code': 'COUNT-COURSE', 'name': 'Count course', 'department_code': 'DEP', 'qualification': 'Degree', 'duration_semesters': 6}
        r.setdefault('batches', {})['COUNT-BATCH'] = {'code': 'COUNT-BATCH', 'program_code': 'COUNT-COURSE', 'name': '2026–2029', 'entry_year': 2026, 'graduation_year': 2029}
        r.setdefault('sections', {})['COUNT-A'] = {'code': 'COUNT-A', 'batch_code': 'COUNT-BATCH', 'name': 'A', 'capacity': 40}
        r['sections']['COUNT-B'] = {'code': 'COUNT-B', 'batch_code': 'COUNT-BATCH', 'name': 'B', 'capacity': 30}
        r.setdefault('students', {})['COUNT-STUDENT'] = {**STUDENT, 'code': 'COUNT-STUDENT', 'status': 'active'}
        r.setdefault('student_enrollments', {}).update({
            'COUNT-E1': {'code': 'COUNT-E1', 'section_code': 'COUNT-A', 'student_code': 'COUNT-STUDENT', 'status': 'active'},
            'COUNT-E2': {'code': 'COUNT-E2', 'section_code': 'COUNT-A', 'student_code': 'COUNT-STUDENT', 'status': 'active'},
            'COUNT-OLD': {'code': 'COUNT-OLD', 'section_code': 'COUNT-B', 'student_code': 'COUNT-STUDENT', 'status': 'inactive'},
        })
    response = client.get('/api/v1/master-data/enrollment/courses/COUNT-COURSE/insights', headers=h)
    assert response.status_code == 200, response.text
    batch = response.json()['batches'][0]
    assert batch['students'] == 1
    assert {s['name']: s['students'] for s in batch['sections']} == {'A': 1, 'B': 0}
    assert batch['sections'][0]['capacity'] == 40
    edited = client.patch('/api/v1/workspace/resources/batches/COUNT-BATCH', headers=h,
                          json={'values': {'graduation_year': 2030, 'name': '2026–2030'}})
    assert edited.status_code == 200, edited.text
    assert edited.json()['graduation_year'] == 2030
    retained = client.delete('/api/v1/academics/batches/COUNT-BATCH', headers=h)
    assert retained.status_code == 409  # linked sections must not be orphaned
    with app.state.store.transaction() as d:
        d['records']['batches']['EMPTY-BATCH'] = {'code': 'EMPTY-BATCH', 'program_code': 'COUNT-COURSE',
                                               'name': '2028–2031', 'entry_year': 2028, 'graduation_year': 2031}
    deleted = client.delete('/api/v1/academics/batches/EMPTY-BATCH', headers=h)
    assert deleted.status_code == 204, deleted.text


def test_batch_overview_and_atomic_section_rename(client, app):
    h = master_data_user(app, client)
    with app.state.store.transaction() as d:
        r = d['records']
        r.setdefault('programs', {})['VIEW-P'] = {'code': 'VIEW-P', 'name': 'Course One', 'department_code': 'DEP', 'qualification': 'Degree', 'duration_semesters': 6}
        r['programs']['VIEW-Q'] = {'code': 'VIEW-Q', 'name': 'Course Two', 'department_code': 'DEP', 'qualification': 'Degree', 'duration_semesters': 6}
        r.setdefault('batches', {})['VIEW-B'] = {'code': 'VIEW-B', 'program_code': 'VIEW-P', 'name': '2026–2029', 'entry_year': 2026, 'graduation_year': 2029}
        r['batches']['VIEW-C'] = {'code': 'VIEW-C', 'program_code': 'VIEW-Q', 'name': '2027–2030', 'entry_year': 2027, 'graduation_year': 2030}
        r.setdefault('sections', {})['VIEW-A'] = {'code': 'VIEW-A', 'batch_code': 'VIEW-B', 'name': 'Alha', 'capacity': 60}
    overview = client.get('/api/v1/master-data/enrollment/batches/overview', headers=h)
    assert overview.status_code == 200, overview.text
    assert overview.json()['totals']['batches'] == 2
    assert {b['course_name'] for b in overview.json()['batches']} == {'Course One', 'Course Two'}
    filtered = client.get('/api/v1/master-data/enrollment/batches/overview?program_code=VIEW-P', headers=h)
    assert len(filtered.json()['batches']) == 1
    payload = {'entry_year': 2026, 'graduation_year': 2030, 'sections': [{'code': 'VIEW-A', 'name': ' Alpha '}]}
    saved = client.patch('/api/v1/master-data/enrollment/batches/VIEW-B', headers=h, json=payload)
    assert saved.status_code == 200, saved.text
    assert saved.json()['sections_updated'] == 1
    snapshot = app.state.store.snapshot()
    assert snapshot['records']['sections']['VIEW-A']['name'] == 'Alpha'
    assert snapshot['records']['batches']['VIEW-B']['graduation_year'] == 2030
    wrong = client.patch('/api/v1/master-data/enrollment/batches/VIEW-C', headers=h, json=payload)
    assert wrong.status_code == 422
    assert app.state.store.snapshot()['records']['batches']['VIEW-C']['entry_year'] == 2027
    invalid = client.patch('/api/v1/master-data/enrollment/batches/VIEW-B', headers=h,
                           json={**payload, 'sections': [{'code': 'VIEW-A', 'name': '   '}]})
    assert invalid.status_code == 422
    assert app.state.store.snapshot()['records']['sections']['VIEW-A']['name'] == 'Alpha'


def test_dated_course_batch_reuses_existing_cohort_and_retires_duplicate_actions(client, app, headers):
    master_data_user(app, client)
    actions = client.get("/api/v1/master-data/actions", headers=headers).json()["actions"]
    assert not {"create-batch", "promote-batch"} & {a["key"] for a in actions}
    course_form = next(a for a in actions if a["key"] == "create-course")
    assert not any(f["key"].startswith("batch.") for f in course_form["fields"])
    with app.state.store.transaction() as data:
        data["records"].setdefault("programs", {})["BCOM"] = {
            "code": "BCOM", "department_code": "DEP", "name": "B.Com", "qualification": "B.Com", "duration_semesters": 6}
        data["records"].setdefault("batches", {})["EXISTING"] = {
            "code": "EXISTING", "program_code": "BCOM", "name": "2026–2029", "entry_year": 2026, "graduation_year": 2029}
    endpoint = "/api/v1/workspace/resources/academic_years"
    values = {"program_code": "BCOM", "start_date": "2026-06-01", "end_date": "2029-05-31"}
    made = client.post(endpoint, headers=headers, json={"values": values})
    assert made.status_code == 201, made.text
    assert made.json()["batch_code"] == "EXISTING"
    code = made.json()["code"]
    updated = client.patch(endpoint + "/" + code, headers=headers,
                           json={"values": {"end_date": "2029-06-01"}})
    assert updated.status_code == 200, updated.text
    assert updated.json()["batch_code"] == "EXISTING"
    assert len(app.state.store.snapshot()["records"]["batches"]) == 1
    from app.modules.master_data.enrollment.api import pick_batch
    from app.modules.master_data.enrollment.schemas import CourseChoice
    choice = CourseChoice(course_level="degree", program_code="BCOM", academic_year_code=code)
    with app.state.store.transaction() as data:
        assert pick_batch(data, choice, 2026, "ADMIN")["code"] == "EXISTING"
    # A new dated batch creates its cohort without a second form.
    new = client.post(endpoint, headers=headers, json={"values": {**values,
                      "start_date": "2027-06-01", "end_date": "2030-05-31"}})
    assert new.status_code == 201, new.text
    assert new.json()["batch_code"] == new.json()["code"]
    assert client.delete("/api/v1/academics/academic-years/" + new.json()["code"], headers=headers).status_code == 204
    assert len(app.state.store.snapshot()["records"]["batches"]) == 1


def staff_payload(kind, aadhaar, **extra):
    base = {
        "kind": kind,
        "personal": {"first_name": "Asha", "last_name": "Rao", "email": f"{aadhaar}@example.edu", "phone": "9876500200",
                     "address": "5 College Road", "city": "Hyderabad"},
        "job": {"designation": "Lecturer", "department": "Physics", "join_date": "2026-06-01"},
        "qualification": {"level": "post_graduation", "specialization": "M.Sc Physics"},
        "certificates": ["M.Sc marks memo", "B.Ed certificate"],
        "aadhaar_number": aadhaar,
        "pan_number": "ABCDE1234F",
        "previous_experience": [{"organization": "City College", "role": "Lecturer", "from_date": "2020-06-01",
                                 "to_date": "2026-05-31"}],
        "employment_history": [{"organization": "City College", "designation": "Lecturer"}],
        "achievements": [{"title": "Best teacher award", "year": 2024}],
        "bank": {"account_holder": "Asha Rao", "account_number": "123456789012", "bank_name": "SBI",
                 "ifsc": "SBIN0001234"},
        "salary": {"components": [
            {"component": "Basic pay", "component_type": "earning", "amount": "40000"},
            {"component": "HRA", "component_type": "earning", "amount": "10000"},
            {"component": "Provident fund", "component_type": "deduction", "amount": "4800"}],
            "in_hand_monthly": "45000"},
    }
    return {**base, **extra}


def test_staff_onboarding_ids_profiles_and_tables(client, app):
    h = master_data_user(app, client)
    options = client.get("/api/v1/master-data/staff-onboarding/options", headers=h).json()
    assert options["employee_id"] == "EMP-COL-001"  # institution "College"

    teacher = client.post("/api/v1/master-data/staff-onboarding", headers=h, json=staff_payload("teaching", "111122223333"))
    assert teacher.status_code == 201, teacher.text
    body = teacher.json()
    assert body["employee"]["code"] == "EMP-COL-001" and body["employee"]["employee_type"] == "teacher"
    assert int(body["role"]["experience_years"]) == 6
    profile = body["profile"]
    assert (profile["gross_monthly"], profile["deductions_monthly"], profile["net_monthly"], profile["in_hand_monthly"]) == \
        ("50000.00", "4800.00", "45200.00", "45000.00")
    assert profile["ctc_annual"] == "600000.00"
    assert set(profile["document_checklist"]) == {"aadhaar_copy", "pan_copy", "certificate_m_sc_marks_memo",
                                                  "certificate_b_ed_certificate", "experience_1", "bank_proof"}

    duplicate = client.post("/api/v1/master-data/staff-onboarding", headers=h,
                            json=staff_payload("non_teaching", "111122223333", pan_number=None))
    assert duplicate.status_code == 409

    staff = client.post("/api/v1/master-data/staff-onboarding", headers=h, json=staff_payload(
        "non_teaching", "444455556666", pan_number="PQRST6789K",
        job={"designation": "Accountant", "join_date": "2026-06-01"}))
    assert staff.status_code == 201, staff.text
    assert staff.json()["employee"]["code"] == "EMP-COL-002"

    labour = client.post("/api/v1/master-data/staff-onboarding", headers=h, json={
        "kind": "labour", "personal": {"first_name": "Ramu", "last_name": "K"},
        "job": {"designation": "Gardener", "join_date": "2026-06-01"},
        "aadhaar_number": "777788889999",
        "bank": {"account_holder": "Ramu K", "account_number": "998877665544", "bank_name": "Canara Bank",
                 "ifsc": "CNRB0004321"},
        "salary": {"basis": "daily", "amount": "600"}})
    assert labour.status_code == 201, labour.text
    labour_body = labour.json()
    assert labour_body["employee"]["code"] == "EMP-COL-003"
    assert labour_body["employee"]["employment_type"] == "daily_wage"
    assert labour_body["profile"]["net_monthly"] == "15600.00"  # 26 working days

    table = client.get("/api/v1/master-data/staff-onboarding?kind=teaching", headers=h).json()["items"]
    assert [r["employee_id"] for r in table] == ["EMP-COL-001"]
    assert table[0]["aadhaar"] == "••••••••3333" and table[0]["bank"] == "SBI ••••••••9012"
    assert table[0]["documents_uploaded"] == 0 and table[0]["documents_expected"] == 6

    upload = client.post("/api/v1/documents/upload", headers=h, json={
        "kind": "employee_document", "person_code": "EMP-COL-001", "filename": "aadhaar.pdf",
        "content_base64": PDF, "document_label": "aadhaar_copy"})
    assert upload.status_code == 201, upload.text
    detail = client.get("/api/v1/master-data/staff-onboarding/EMP-COL-001", headers=h).json()
    assert detail["profile"]["document_checklist"]["aadhaar_copy"]["uploaded"] is True
    assert len(detail["salary_components"]) == 3



def test_staff_edit_preserves_identity_documents_and_related_records(client, app):
    h = master_data_user(app, client)
    payload = staff_payload("teaching", "111122223333")
    made = client.post("/api/v1/master-data/staff-onboarding", headers=h, json=payload).json()
    code = made["employee"]["code"]
    upload = client.post("/api/v1/documents/upload", headers=h, json={
        "kind": "employee_document", "person_code": code, "filename": "aadhaar.pdf",
        "content_base64": PDF, "document_label": "aadhaar_copy"})
    assert upload.status_code == 201, upload.text
    payload["personal"]["first_name"] = "Asha Updated"
    payload["personal"]["city"] = "Warangal"
    payload["qualification"]["specialization"] = "Applied Physics"
    payload["salary"]["components"] = [
        {"component": "Basic pay", "component_type": "earning", "amount": "60000"},
        {"component": "PF", "component_type": "deduction", "amount": "6000"}]
    saved = client.put(f"/api/v1/master-data/staff-onboarding/{code}", headers=h, json=payload)
    assert saved.status_code == 200, saved.text
    result = saved.json()
    assert result["employee"]["code"] == code
    assert result["employee"]["first_name"] == "Asha Updated"
    assert result["profile"]["code"] == made["profile"]["code"]
    assert result["profile"]["document_checklist"]["aadhaar_copy"]["uploaded"] is True
    assert result["profile"]["net_monthly"] == "54000.00"
    assert result["role"]["code"] == made["role"]["code"]
    assert result["role"]["specialization"] == "Applied Physics"
    assert len(result["salary_components"]) == 2
    assert result["salary_components"][0]["code"] == made["salary_components"][0]["code"]
    detail = client.get(f"/api/v1/master-data/staff-onboarding/{code}", headers=h).json()
    assert detail["department"] == "Physics" and detail["employee"]["city"] == "Warangal"
    assert len(detail["salary_components"]) == 2
    files = client.get(f"/api/v1/documents/files/employee/{code}", headers=h).json()["items"]
    assert len(files) == 1 and files[0]["original_filename"] == "aadhaar.pdf"
    assert client.get("/api/v1/master-data/staff-onboarding?kind=teaching", headers=h).json()["total"] == 1


def test_staff_edit_denies_missing_grants_and_rolls_back_invalid_changes(client, app):
    h = master_data_user(app, client)
    payload = staff_payload("teaching", "111122223333")
    made = client.post("/api/v1/master-data/staff-onboarding", headers=h, json=payload).json()
    code = made["employee"]["code"]
    other = staff_payload("teaching", "444455556666", pan_number="PQRST6789K")
    assert client.post("/api/v1/master-data/staff-onboarding", headers=h, json=other).status_code == 201
    payload["personal"]["first_name"] = "Must not persist"
    payload["aadhaar_number"] = "444455556666"
    assert client.put(f"/api/v1/master-data/staff-onboarding/{code}", headers=h, json=payload).status_code == 409
    assert client.get(f"/api/v1/master-data/staff-onboarding/{code}", headers=h).json()["employee"]["first_name"] == "Asha"
    payload["aadhaar_number"] = "111122223333"
    with app.state.store.transaction() as data:
        data["roles"][role_tool.ROLE_CODE]["permissions"]["employees"] = ["view", "create"]
    assert client.put(f"/api/v1/master-data/staff-onboarding/{code}", headers=h, json=payload).status_code == 403
    assert client.get(f"/api/v1/master-data/staff-onboarding/{code}", headers=h).json()["employee"]["first_name"] == "Asha"


def fee_schedule_setup(app, client):
    headers = master_data_user(app, client)
    with app.state.store.transaction() as data:
        data['records'].setdefault('programs', {})['INT-MPC'] = {
            'code': 'INT-MPC', 'department_code': 'DEP', 'name': 'Inter MPC',
            'qualification': 'Intermediate', 'duration_semesters': 4,
        }
    return headers


def test_inline_course_fee_edit_and_add_rows(client, app):
    h = fee_schedule_setup(app, client)
    values = {'program_code': 'INT-MPC', 'academic_year_code': 'AY', 'year_of_study': 1,
        'due_date': '2026-06-15', 'lines': [
            {'name': 'Tuition fee', 'category': 'academic', 'amount': '3500.00'},
            {'name': 'Library fee', 'category': 'academic', 'amount': '100.00'},
        ]}
    created = client.post('/api/v1/master-data/actions/course-fee-structure', headers=h, json={'values': values})
    assert created.status_code == 201, created.text
    tuition, library = created.json()['fee_structures']
    values['lines'] = [
        {'code': tuition['code'], 'fee_head_code': tuition['fee_head_code'], 'amount': '4000.00'},
        {'code': library['code'], 'fee_head_code': library['fee_head_code'], 'amount': '100.00'},
        {'name': 'Sports fee', 'category': 'other', 'amount': '250.00'},
    ]
    edited = client.post('/api/v1/master-data/actions/course-fee-structure', headers=h, json={'values': values})
    assert edited.status_code == 201, edited.text
    rows = edited.json()['fee_structures']
    assert len(rows) == 3
    assert rows[0]['code'] == tuition['code']
    assert str(rows[0]['amount']) == '4000.00'
    state = app.state.store.snapshot()
    assert len(state['records']['fee_structures']) == 3
    assert state['records']['fee_heads'][rows[2]['fee_head_code']]['name'] == 'Sports fee'


def test_inline_fee_rows_validate_course_and_rollback(client, app):
    h = fee_schedule_setup(app, client)
    values = {'program_code': 'INT-MPC', 'academic_year_code': 'AY', 'due_date': '2026-06-15',
        'lines': [{'name': 'Tuition fee', 'amount': '3500.00'}]}
    created = client.post('/api/v1/master-data/actions/course-fee-structure', headers=h, json={'values': values})
    assert created.status_code == 201, created.text
    row = created.json()['fee_structures'][0]
    duplicate = {**values, 'lines': [
        {'code': row['code'], 'fee_head_code': row['fee_head_code'], 'amount': '4500.00'},
        {'fee_head_code': row['fee_head_code'], 'amount': '10'},
    ]}
    assert client.post('/api/v1/master-data/actions/course-fee-structure', headers=h, json={'values': duplicate}).status_code == 422
    assert str(app.state.store.snapshot()['records']['fee_structures'][row['code']]['amount']) == '3500.00'
    invalid_scope = {**values, 'year_of_study': 2, 'lines': [
        {'code': row['code'], 'fee_head_code': row['fee_head_code'], 'amount': '3500.00'}]}
    assert client.post('/api/v1/master-data/actions/course-fee-structure', headers=h, json={'values': invalid_scope}).status_code == 409


def test_inline_fees_cannot_change_already_charged_amounts(client, app):
    h = fee_schedule_setup(app, client)
    values = {'program_code': 'INT-MPC', 'academic_year_code': 'AY', 'due_date': '2026-06-15',
        'lines': [{'name': 'Tuition fee', 'amount': '3500.00'}]}
    created = client.post('/api/v1/master-data/actions/course-fee-structure', headers=h, json={'values': values})
    assert created.status_code == 201, created.text
    row = created.json()['fee_structures'][0]
    with app.state.store.transaction() as data:
        data['records'].setdefault('student_fee_charges', {})['CHARGED'] = {
            'code': 'CHARGED', 'fee_structure_code': row['code'], 'student_code': 'S', 'amount': '3500.00'}
    values['lines'] = [{'code': row['code'], 'fee_head_code': row['fee_head_code'], 'amount': '4500.00'}]
    denied = client.post('/api/v1/master-data/actions/course-fee-structure', headers=h, json={'values': values})
    assert denied.status_code == 409, denied.text
    assert str(app.state.store.snapshot()['records']['fee_structures'][row['code']]['amount']) == '3500.00'


def test_non_teaching_and_daily_wage_staff_can_be_edited(client, app):
    h = master_data_user(app, client)
    for kind, aadhaar, pan in [("non_teaching", "111122223333", "ABCDE1234F"), ("labour", "444455556666", None)]:
        payload = staff_payload(kind, aadhaar, pan_number=pan)
        if kind == "labour":
            payload.update(qualification=None, certificates=[], previous_experience=[], employment_history=[], achievements=[], salary={"basis":"daily", "amount":"600"})
        created = client.post("/api/v1/master-data/staff-onboarding", headers=h, json=payload)
        assert created.status_code == 201, created.text
        made = created.json()
        code = made["employee"]["code"]
        payload["personal"]["first_name"] = "Updated employee"
        if kind == "labour":
            payload["salary"]["amount"] = "650"
        else:
            payload["job"]["designation"] = "Senior administrator"
        saved = client.put(f"/api/v1/master-data/staff-onboarding/{code}", headers=h, json=payload)
        assert saved.status_code == 200, saved.text
        result = saved.json()
        assert result["employee"]["code"] == code
        assert result["employee"]["first_name"] == "Updated employee"
        assert result["profile"]["code"] == made["profile"]["code"]
        if kind == "labour":
            assert result["profile"]["salary_basis"] == "daily"
            assert result["profile"]["salary_amount"] == "650.00"
            assert result["profile"]["net_monthly"] == "16900.00"
            assert result["role"] is None
        else:
            assert result["role"]["code"] == made["role"]["code"]
            assert result["role"]["responsibility"] == "Senior administrator"


def test_fee_basis_separates_annual_course_and_semester_schedules(client,app):
    h=fee_schedule_setup(app,client)
    body={'program_code':'INT-MPC','academic_year_code':'AY','year_of_study':1,'due_date':'2026-06-15','term_count':4,'lines':[{'name':'Training fee','amount':'1000'}]}
    ids=[]
    for basis in ('annual','full_course','semester'):
        response=client.post('/api/v1/master-data/actions/course-fee-structure',headers=h,json={'values':{**body,'fee_basis':basis}})
        assert response.status_code==201,response.text
        ids.append(response.json()['fee_structures'][0]['code'])
    assert len(set(ids))==3
    assert len(app.state.store.snapshot()['records']['fee_structures'])==3
    with app.state.store.transaction() as data:data['records']['academic_years']['AY']['program_code']='OTHER'
    response=client.post('/api/v1/master-data/actions/course-fee-structure',headers=h,json={'values':body})
    assert response.status_code==422
