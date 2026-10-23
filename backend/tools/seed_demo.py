"""Explicit local-only demo seed. Refuses to overwrite any existing business records."""

import getpass
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.resources import CATALOG, ensure_references, validate_record
from app.core.security import hasher
from app.core.settings import Settings
from app.core.storage import Store, audit, new_code, now
from app.modules.finance.transactions.api import record_payment
from app.workflows.schemas import PaymentInput


def populate(store, password):
    if not 12 <= len(password) <= 128:
        raise ValueError("Use a password of 12–128 characters")
    with store.transaction() as data:
        if any(data["records"].values()):
            raise ValueError(
                "Business data already exists; demo seed refused to overwrite it"
            )

        def add(table, values):
            row = dict(values)
            for field in CATALOG[table]["fields"]:
                key = field["name"]
                if key in row or not field["required"]:
                    continue
                sql = field["type"]
                reference = field["reference"]
                if reference:
                    options = (
                        data["accounts"]
                        if reference == "users"
                        else data["records"].get(reference, {})
                    )
                    if not options:
                        raise ValueError(
                            "Missing demo dependency "
                            + reference
                            + " for "
                            + table
                            + "."
                            + key
                        )
                    row[key] = next(iter(options))
                elif field["choices"]:
                    row[key] = field["choices"][0]
                elif sql == "boolean":
                    row[key] = False
                elif sql in {"integer", "bigint", "smallint"}:
                    row[key] = 1
                elif sql in {"numeric", "decimal", "double precision", "real"}:
                    row[key] = "0"
                elif sql == "date":
                    row[key] = "2026-10-22"
                elif "timestamp" in sql:
                    row[key] = now()
                elif sql.startswith("time"):
                    row[key] = "09:00:00"
                elif sql in {"json", "jsonb"}:
                    row[key] = {}
                elif sql == "ARRAY":
                    row[key] = []
                else:
                    row[key] = "Demo " + key.replace("_", " ")
            row = validate_record(table, row)
            ensure_references(data, table, row)
            data["records"].setdefault(table, {})[row["code"]] = row
            return row

        add(
            "institutions",
            {"code": "EDU", "name": "EduNexa Demo College", "country": "India"},
        )
        add(
            "campuses",
            {
                "code": "MAIN",
                "institution_code": "EDU",
                "name": "Main campus",
                "city": "Chennai",
                "state": "Tamil Nadu",
            },
        )
        add("departments", {"code": "SCI", "campus_code": "MAIN", "name": "Science"})
        add(
            "academic_years",
            {
                "code": "AY-2026",
                "name": "2026-2027",
                "start_date": "2026-06-01",
                "end_date": "2027-05-31",
            },
        )
        add(
            "programs",
            {
                "code": "BSC",
                "department_code": "SCI",
                "name": "B.Sc. Applied Sciences",
                "qualification": "B.Sc.",
                "duration_semesters": 6,
                "intake_capacity": 60,
            },
        )
        add(
            "batches",
            {
                "code": "BATCH-26",
                "program_code": "BSC",
                "name": "2026 intake",
                "entry_year": 2026,
                "graduation_year": 2029,
            },
        )
        add(
            "semesters",
            {
                "code": "SEM1",
                "academic_year_code": "AY-2026",
                "name": "Semester 1",
                "semester_number": 1,
                "start_date": "2026-06-01",
                "end_date": "2026-12-31",
            },
        )
        add(
            "sections",
            {
                "code": "SEC-A",
                "batch_code": "BATCH-26",
                "semester_code": "SEM1",
                "name": "Section A",
                "capacity": 60,
            },
        )
        for code, first, last, category, designation in [
            ("EMP-ADMIN", "Kumar", "Demo", "staff", "Administrator"),
            ("EMP-TEACHER", "Kavitha", "Demo", "teacher", "Lecturer"),
            ("EMP-DRIVER", "Ravi", "Demo", "staff", "Driver"),
        ]:
            add(
                "employees",
                {
                    "code": code,
                    "campus_code": "MAIN",
                    "department_code": "SCI",
                    "first_name": first,
                    "last_name": last,
                    "employee_type": category,
                    "designation": designation,
                    "email": code.lower() + "@example.test",
                    "phone": "9999900000",
                    "join_date": "2026-06-01",
                    "employment_type": "permanent",
                    "status": "active",
                },
            )
        add(
            "teachers",
            {
                "code": "FAC1",
                "employee_code": "EMP-TEACHER",
                "qualification": "M.Sc.",
                "specialization": "Applied sciences",
                "experience_years": 8,
            },
        )
        add(
            "subjects",
            {
                "code": "SUB1",
                "department_code": "SCI",
                "name": "Applied Physics",
                "credits": "4",
                "subject_type": "theory",
            },
        )
        add(
            "curriculum_subjects",
            {
                "code": "CUR1",
                "program_code": "BSC",
                "subject_code": "SUB1",
                "semester_number": 1,
                "is_required": True,
            },
        )
        add(
            "subject_offerings",
            {
                "code": "OFFER1",
                "subject_code": "SUB1",
                "section_code": "SEC-A",
                "teacher_code": "FAC1",
            },
        )
        add(
            "rooms",
            {
                "code": "ROOM1",
                "campus_code": "MAIN",
                "name": "Science 101",
                "room_type": "classroom",
                "capacity": 60,
            },
        )
        add(
            "timetable_slots",
            {
                "code": "SLOT1",
                "offering_code": "OFFER1",
                "room_code": "ROOM1",
                "weekday": 1,
                "start_time": "09:00:00",
                "end_time": "10:00:00",
            },
        )
        add(
            "students",
            {
                "code": "STU1",
                "campus_code": "MAIN",
                "admission_number": "ADM-2026-001",
                "first_name": "Ananya",
                "last_name": "Demo",
                "date_of_birth": "2008-06-15",
                "gender": "female",
                "admission_date": "2026-06-01",
                "address": "Demo address",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "postal_code": "600001",
                "country": "India",
                "emergency_contact_name": "Priya Demo",
                "emergency_contact_phone": "9999900001",
                "status": "active",
            },
        )
        add(
            "parents",
            {
                "code": "PAR1",
                "first_name": "Priya",
                "last_name": "Demo",
                "phone": "9999900001",
                "email": "parent@example.test",
            },
        )
        add(
            "student_parents",
            {
                "code": "LINK1",
                "student_code": "STU1",
                "parent_code": "PAR1",
                "relationship": "mother",
                "is_primary": True,
                "can_pickup": True,
                "receives_notifications": False,
            },
        )
        add(
            "student_enrollments",
            {
                "code": "ENR1",
                "student_code": "STU1",
                "section_code": "SEC-A",
                "roll_number": "R001",
                "enrolled_on": "2026-06-01",
                "status": "active",
            },
        )
        add(
            "student_subjects",
            {"code": "SS1", "enrollment_code": "ENR1", "offering_code": "OFFER1"},
        )
        add(
            "fee_heads",
            {
                "code": "TUITION",
                "name": "Tuition fees",
                "collection_ownership": "internal",
                "scholarship_eligible": True,
            },
        )
        add(
            "fee_structures",
            {
                "code": "FEE1",
                "program_code": "BSC",
                "academic_year_code": "AY-2026",
                "fee_head_code": "TUITION",
                "semester_number": 1,
                "amount": "50000",
                "due_date": "2026-10-01",
                "currency": "INR",
                "installment_number": 1,
                "billing_frequency": "semester",
            },
        )
        add(
            "student_fee_charges",
            {
                "code": "CHARGE1",
                "student_code": "STU1",
                "fee_structure_code": "FEE1",
                "amount": "50000",
                "tax_amount": "0",
                "due_date": "2026-10-01",
            },
        )
        add(
            "scholarships",
            {
                "code": "MERIT",
                "name": "Merit award",
                "academic_year_code": "AY-2026",
                "maximum_amount": "10000",
                "award_method": "fixed",
                "eligibility_rules": {},
            },
        )
        add(
            "student_scholarships",
            {
                "code": "AWARD1",
                "student_code": "STU1",
                "scholarship_code": "MERIT",
                "amount": "10000",
                "status": "pending",
            },
        )
        add(
            "leave_types", {"code": "CASUAL", "name": "Casual leave", "annual_days": 12}
        )
        add(
            "employee_salary_components",
            {
                "code": "BASIC1",
                "employee_code": "EMP-TEACHER",
                "component": "Basic salary",
                "component_type": "earning",
                "amount": "30000",
                "effective_from": "2026-06-01",
            },
        )
        add(
            "employee_salary_components",
            {
                "code": "ALLOW1",
                "employee_code": "EMP-TEACHER",
                "component": "Allowances",
                "component_type": "earning",
                "amount": "5000",
                "effective_from": "2026-06-01",
            },
        )
        add(
            "employee_salary_components",
            {
                "code": "DEDUCT1",
                "employee_code": "EMP-TEACHER",
                "component": "Configured deduction",
                "component_type": "deduction",
                "amount": "1800",
                "effective_from": "2026-06-01",
            },
        )
        add(
            "payroll_runs",
            {
                "code": "PAYROLL-OCT",
                "campus_code": "MAIN",
                "period_start": "2026-10-01",
                "period_end": "2026-10-31",
                "status": "draft",
            },
        )
        add(
            "attendance_sessions",
            {
                "code": "ATT1",
                "offering_code": "OFFER1",
                "session_date": "2026-10-22",
                "start_time": "09:00:00",
                "end_time": "10:00:00",
                "recorded_by_code": "FAC1",
            },
        )
        add(
            "student_attendance",
            {
                "code": "SA1",
                "session_code": "ATT1",
                "student_code": "STU1",
                "status": "present",
            },
        )
        add(
            "assignments",
            {
                "code": "HW1",
                "offering_code": "OFFER1",
                "title": "Motion and forces",
                "instructions": "Submit your worked examples",
                "due_at": "2099-10-30T17:00:00+00:00",
                "max_marks": "20",
            },
        )
        add(
            "learning_resources",
            {
                "code": "RES1",
                "offering_code": "OFFER1",
                "title": "Semester syllabus",
                "resource_url": "https://example.org/syllabus",
                "resource_type": "link",
            },
        )
        add(
            "exams",
            {
                "code": "EXAM1",
                "semester_code": "SEM1",
                "name": "Internal assessment",
                "exam_type": "internal",
                "start_date": "2026-10-20",
                "end_date": "2026-10-23",
            },
        )
        add(
            "exam_papers",
            {
                "code": "PAPER1",
                "exam_code": "EXAM1",
                "offering_code": "OFFER1",
                "room_code": "ROOM1",
                "exam_date": "2026-10-22",
                "start_time": "10:00:00",
                "end_time": "12:00:00",
                "max_marks": "100",
                "pass_marks": "40",
            },
        )
        add(
            "exam_results",
            {
                "code": "MARK1",
                "paper_code": "PAPER1",
                "student_code": "STU1",
                "marks": "86",
                "is_absent": False,
                "grade": "A",
                "published": True,
            },
        )
        add(
            "hostels",
            {
                "code": "HOSTEL1",
                "campus_code": "MAIN",
                "name": "Main hostel",
                "warden_employee_code": "EMP-ADMIN",
            },
        )
        add(
            "hostel_rooms",
            {
                "code": "HR101",
                "hostel_code": "HOSTEL1",
                "room_number": "101",
                "capacity": 2,
            },
        )
        add("hostel_beds", {"code": "BED1", "room_code": "HR101", "bed_number": "A"})
        add(
            "hostel_allocations",
            {
                "code": "HA1",
                "student_code": "STU1",
                "bed_code": "BED1",
                "start_date": "2026-06-01",
            },
        )
        add(
            "vehicles",
            {
                "code": "BUS1",
                "campus_code": "MAIN",
                "registration_number": "DEMO-BUS-01",
                "capacity": 40,
                "driver_employee_code": "EMP-DRIVER",
            },
        )
        add(
            "transport_routes",
            {
                "code": "ROUTE1",
                "campus_code": "MAIN",
                "name": "City centre",
                "vehicle_code": "BUS1",
            },
        )
        add(
            "transport_stops",
            {
                "code": "STOP1",
                "route_code": "ROUTE1",
                "name": "Central stop",
                "sequence_number": 1,
                "pickup_time": "07:45:00",
                "drop_time": "17:00:00",
            },
        )
        add(
            "transport_allocations",
            {
                "code": "TA1",
                "student_code": "STU1",
                "stop_code": "STOP1",
                "start_date": "2026-06-01",
            },
        )
        add(
            "certificate_types",
            {
                "code": "BONAFIDE",
                "name": "Bonafide certificate",
                "template_reference": "bonafide-v1",
            },
        )
        add(
            "library_books",
            {
                "code": "BOOK1",
                "title": "Applied Physics",
                "author": "Demo Author",
                "isbn": "DEMO-ISBN",
                "category": "Science",
            },
        )
        add(
            "library_copies",
            {
                "code": "COPY1",
                "book_code": "BOOK1",
                "accession_number": "ACC1",
                "status": "available",
            },
        )
        add(
            "calendar_events",
            {
                "code": "EVENT1",
                "campus_code": "MAIN",
                "title": "College science day",
                "starts_at": "2026-11-01T09:00:00+00:00",
                "ends_at": "2026-11-01T17:00:00+00:00",
                "event_type": "academic",
            },
        )
        add(
            "admission_sources",
            {"code": "WEB", "name": "Website", "channel": "website", "is_active": True},
        )
        add(
            "admission_sources",
            {
                "code": "WALKIN",
                "name": "Walk-in",
                "channel": "walk_in",
                "is_active": True,
            },
        )
        add(
            "admission_cycles",
            {
                "code": "CYCLE1",
                "campus_code": "MAIN",
                "academic_year_code": "AY-2026",
                "name": "2026 admissions",
                "opens_on": "2026-01-01",
                "closes_on": "2027-05-31",
            },
        )
        add(
            "document_types",
            {
                "code": "ID",
                "name": "Identity document",
                "accepted_mime_types": ["application/pdf", "image/png", "image/jpeg"],
                "maximum_file_bytes": 650000,
                "expiry_required": False,
                "original_sighting_required": True,
                "is_active": True,
            },
        )
        data["roles"]["DEMO-ADMIN"] = {
            "code": "DEMO-ADMIN",
            "name": "Demo College Administrator",
            "scope": "college",
            "permissions": {
                key: ["view", "create", "edit", "delete", "approve", "export"]
                for key in set(CATALOG)
                | {"accounts", "roles", "forms", "reports", "audit", "mobile"}
            },
            "system_admin": False,
        }
        data["roles"]["DEMO-FACULTY"] = {
            "code": "DEMO-FACULTY",
            "name": "Faculty",
            "scope": "teaching",
            "permissions": {},
            "system_admin": False,
        }
        data["roles"]["DEMO-PERSONAL"] = {
            "code": "DEMO-PERSONAL",
            "name": "Personal user",
            "scope": "self",
            "permissions": {},
            "system_admin": False,
        }
        for login, kind, person, roles, clients in [
            (
                "demo.admin",
                "employee",
                "EMP-ADMIN",
                ["DEMO-ADMIN"],
                ["admin-web", "admin-mobile"],
            ),
            (
                "demo.teacher",
                "employee",
                "EMP-TEACHER",
                ["DEMO-FACULTY"],
                ["admin-web", "teacher-mobile"],
            ),
            (
                "demo.parent",
                "parent",
                "PAR1",
                ["DEMO-PERSONAL"],
                ["admin-web", "parent-mobile"],
            ),
            (
                "demo.student",
                "student",
                "STU1",
                ["DEMO-PERSONAL"],
                ["admin-web", "student-mobile"],
            ),
        ]:
            code = new_code("USR")
            data["accounts"][code] = {
                "code": code,
                "login_id": login,
                "password_hash": hasher.hash(password),
                "active": True,
                "person_type": kind,
                "person_code": person,
                "role_codes": roles,
                "clients": clients,
            }
        admin = next(
            a for a in data["accounts"].values() if a["login_id"] == "demo.admin"
        )
        record_payment(
            data,
            PaymentInput(
                student_code="STU1",
                method="cash",
                paid_on=date(2026, 10, 22),
                transaction_reference="DEMO-COLLECTION-1",
                allocations={"CHARGE1": Decimal("10000")},
            ),
            "demo-payment-1",
            admin["code"],
        )
        add(
            "announcements",
            {
                "code": "NOTICE1",
                "campus_code": "MAIN",
                "title": "Welcome to the academic year",
                "body": "This is an explicitly seeded local demonstration college.",
                "published_at": "2026-06-01T00:00:00+00:00",
                "author_code": "EMP-ADMIN",
            },
        )
        audit(data, admin["code"], "demo_seed", "institutions", "EDU")
    return ["demo.admin", "demo.teacher", "demo.parent", "demo.student"]


if __name__ == "__main__":
    settings = Settings()
    password = getpass.getpass(
        "Choose a password for the four local demo accounts (minimum 12 characters): "
    )
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match")
    try:
        users = populate(Store(settings.data_dir), password)
    except (ValueError, Exception) as e:
        raise SystemExit(str(e))
    print(
        "Local demonstration created. SQL was not contacted. Login IDs: "
        + ", ".join(users)
    )
