"""One-time: demo scholarship schemes, student awards and admission enquiries. Run once on the
server from the backend folder (it uses the server's own .env and database):

    .venv\\Scripts\\python.exe tools\\seed_demo_admissions.py      (Windows)
    .venv/bin/python tools/seed_demo_admissions.py                (macOS / Linux)

In one database transaction it adds:
  * six scholarship schemes (merit, need-based, sports, sibling, girl child, staff ward) with the
    award, eligibility criteria, documents required, terms & conditions and renewal rules;
  * awards for demo students (approved, disbursed, pending, rejected); approved and disbursed awards
    are adjusted against the student's fee charges, so ledgers and receipts show the concession;
  * admission sources and 24 admission enquiries across the demo courses, at every stage
    (new, contacted, counselling, applied, joined, not interested) with guardian, address,
    reference and follow-up details.

Nothing that already exists is changed; running it again adds only what is missing. After a
successful run this file deletes itself; if anything fails nothing is saved and it is kept.
"""
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
sys.path.insert(0, str(HERE.parent))

from app.core.settings import Settings  # noqa: E402
from app.core.storage import audit, new_code, now  # noqa: E402
from create_master_data_role import store_for  # noqa: E402

RUN = "demo-admissions-2026-v1"
SCHEMES = [
    ("SCH-MERIT", "Merit scholarship", "Pragathi Educational Society", "percentage", "50", "25000", {
        "description": "Rewards academic excellence. Students with outstanding marks in the qualifying examination "
                       "receive a concession on tuition fees for the year.",
        "criteria": ["90% or above in the qualifying examination (SSC / Intermediate)",
                     "No disciplinary action in the previous academic year",
                     "Minimum 85% attendance in the previous year (continuing students)"],
        "documents": ["Marks memo of the qualifying examination (original and copy)", "Aadhaar card", "Bank passbook copy of the student"],
        "terms": ["The concession is adjusted against tuition fee only; other fees are payable in full.",
                  "Renewal requires 80% marks in the annual examination and 85% attendance.",
                  "The scholarship is withdrawn if the student leaves the college midway; fees concessioned become payable.",
                  "Only one college scholarship can be availed in a year; the higher one is applied.",
                  "The decision of the scholarship committee is final."],
        "how_to_apply": "Apply at the accounts office within 30 days of admission", "renewal": "Yearly, on result review",
        "disbursal": "Adjusted against tuition fee", "last_date": "2026-07-31"}),
    ("SCH-NEED", "Need-based financial aid", "Pragathi Educational Society", "fixed_amount", None, "20000", {
        "description": "Financial support for students from families with limited income so that no deserving student "
                       "discontinues for want of fees.",
        "criteria": ["Annual family income below INR 2,50,000", "Minimum 60% in the qualifying examination",
                     "Regular attendance (75% or more)"],
        "documents": ["Income certificate issued by the Tahsildar (current year)", "Ration card / white card copy",
                      "Marks memo", "Aadhaar card of student and parent"],
        "terms": ["Aid is fixed per year and adjusted against the semester fee instalments.",
                  "False income declarations lead to cancellation and recovery of the aid.",
                  "Aid is reviewed every year; a fresh income certificate is required for renewal.",
                  "Students must maintain 75% attendance to continue receiving aid."],
        "how_to_apply": "Submit the application form with documents to the scholarship committee",
        "renewal": "Yearly with fresh income certificate", "disbursal": "Adjusted against fees", "last_date": "2026-08-15"}),
    ("SCH-SPORTS", "Sports excellence scholarship", "Alumni Association", "fixed_amount", None, "15000", {
        "description": "For students who represent the college, district or state in recognised sports.",
        "criteria": ["Participation at district level or higher in the last two years",
                     "Commitment to represent the college in inter-collegiate events", "Minimum 55% in the qualifying examination"],
        "documents": ["Sports participation / merit certificates", "Recommendation from the physical director", "Marks memo"],
        "terms": ["Students must attend practice sessions and represent the college when selected.",
                  "The scholarship may be withdrawn for indiscipline or non-participation.",
                  "Academic progress is reviewed each semester."],
        "how_to_apply": "Apply through the physical education department", "renewal": "Yearly on performance",
        "disbursal": "Adjusted against fees", "last_date": "2026-08-31"}),
    ("SCH-SIBLING", "Sibling concession", "College", "percentage", "10", "8000", {
        "description": "A concession for the second child of a family studying in the college at the same time.",
        "criteria": ["An elder brother or sister currently studying in the college", "Both students on regular rolls"],
        "documents": ["Admission numbers of both students", "Proof of relationship (ration card / birth certificate)"],
        "terms": ["The concession applies to the younger sibling's tuition fee only.",
                  "It ends when the elder sibling completes or leaves the course."],
        "how_to_apply": "Request at the accounts office at admission", "renewal": "Automatic while both study here",
        "disbursal": "Adjusted against tuition fee"}),
    ("SCH-GIRL", "Girl child education award", "Pragathi Educational Society", "fixed_amount", None, "10000", {
        "description": "Encourages higher education for girl students, especially first-generation learners.",
        "criteria": ["Girl students admitted to the first year", "Minimum 70% in the qualifying examination",
                     "Preference to first-generation graduates"],
        "documents": ["Marks memo", "Aadhaar card", "Declaration of first-generation learner (if applicable)"],
        "terms": ["The award is a one-time grant for the first year.", "It is adjusted against the first semester fee."],
        "how_to_apply": "Apply at the accounts office", "renewal": "One-time award", "disbursal": "Adjusted against fees"}),
    ("SCH-STAFFWARD", "Staff ward concession", "College", "percentage", "25", "15000", {
        "description": "A tuition concession for children of the college's permanent staff.",
        "criteria": ["Parent is a permanent employee of the college with at least one year of service"],
        "documents": ["Staff ID of the parent", "Proof of relationship"],
        "terms": ["Ends if the parent leaves the college service.", "Applies to tuition fee only."],
        "how_to_apply": "Request through the HR office", "renewal": "Yearly while the parent is in service",
        "disbursal": "Adjusted against tuition fee"}),
]
FIRST = ["Aarav", "Diya", "Vihaan", "Ananya", "Arjun", "Saanvi", "Reyansh", "Myra", "Krishna", "Ira", "Sai", "Aadhya",
         "Rohan", "Kavya", "Ishaan", "Meera", "Aditya", "Nikhita", "Varun", "Pooja", "Karthik", "Sneha", "Rahul", "Lakshmi"]
LAST = ["Reddy", "Rao", "Sharma", "Naidu", "Varma", "Iyer", "Kumar", "Patel", "Goud", "Chowdary", "Nair", "Prasad"]
CITIES = [("Hyderabad", "500072"), ("Secunderabad", "500003"), ("Warangal", "506002"), ("Karimnagar", "505001"),
          ("Nizamabad", "503001"), ("Khammam", "507001")]
STAGES = ["new", "contacted", "counselling", "applied", "joined", "not_interested"]


def apply(data, today):
    records = data["records"]
    years = sorted((y for y in records.get("academic_years", {}).values() if str(y["code"]).startswith("D26-")), key=lambda y: y["code"])
    years = years or sorted(records.get("academic_years", {}).values(), key=lambda y: y["code"])
    if not years:
        return None
    employees = [e for e in records.get("employees", {}).values() if e.get("status", "active") == "active"]
    staff = next((e["code"] for e in employees if "admin" in str(e.get("designation", "")).lower()), employees[0]["code"] if employees else None)
    report = {"schemes": 0, "awards": 0, "concessions": 0, "sources": 0, "enquiries": 0}

    # Scholarship schemes.
    table = records.setdefault("scholarships", {})
    for code, title, sponsor, method, percent, maximum, rules in SCHEMES:
        if code in table:
            continue
        table[code] = {"code": code, "name": title, "sponsor": sponsor, "academic_year_code": years[0]["code"], "maximum_amount": maximum,
                       "award_method": method, "award_percent": percent, "eligibility_rules": rules, "demo_run": RUN}
        report["schemes"] += 1

    # Awards for demo students, adjusted against their fee charges.
    awards = records.setdefault("student_scholarships", {})
    awarded = {a.get("student_code") for a in awards.values()}
    students = sorted((s for s in records.get("students", {}).values() if str(s["code"]).startswith("D26-")), key=lambda s: s["code"])
    charges = {}
    for c in records.get("student_fee_charges", {}).values():
        charges.setdefault(c.get("student_code"), []).append(c)
    allocated = {}
    for a in records.get("charge_scholarship_allocations", {}).values():
        allocated[a.get("charge_code")] = allocated.get(a.get("charge_code"), Decimal("0")) + Decimal(str(a.get("amount") or 0))
    paid = {}
    for a in records.get("payment_allocations", {}).values():
        paid[a.get("charge_code")] = paid.get(a.get("charge_code"), Decimal("0")) + Decimal(str(a.get("amount") or 0))
    plan = [("SCH-MERIT", "approved", "7500"), ("SCH-NEED", "disbursed", "6000"), ("SCH-SPORTS", "approved", "5000"),
            ("SCH-MERIT", "pending", "7500"), ("SCH-SIBLING", "approved", "1500"), ("SCH-GIRL", "disbursed", "4000"),
            ("SCH-NEED", "pending", "6000"), ("SCH-STAFFWARD", "approved", "3750"), ("SCH-SPORTS", "rejected", "5000"),
            ("SCH-MERIT", "disbursed", "7500"), ("SCH-GIRL", "approved", "4000"), ("SCH-NEED", "approved", "6000")]
    for student, (scheme, status, value) in zip([s for s in students if s["code"] not in awarded][::3], plan):
        code = new_code("AWARD")
        awards[code] = {"code": code, "student_code": student["code"], "scholarship_code": scheme, "amount": value, "status": status,
                        "demo_run": RUN, "decided_on": today.isoformat()}
        report["awards"] += 1
        if status in {"approved", "disbursed"} and staff:
            left = Decimal(value)
            for charge in sorted(charges.get(student["code"], []), key=lambda c: str(c.get("due_date") or ""), reverse=True):
                room = Decimal(str(charge.get("amount") or 0)) - paid.get(charge["code"], Decimal("0")) - allocated.get(charge["code"], Decimal("0"))
                take = min(left, room)
                if take <= 0:
                    continue
                alloc = new_code("CSA")
                records.setdefault("charge_scholarship_allocations", {})[alloc] = {
                    "code": alloc, "charge_code": charge["code"], "student_scholarship_code": code, "amount": str(take),
                    "allocated_by_employee_code": staff, "demo_run": RUN}
                allocated[charge["code"]] = allocated.get(charge["code"], Decimal("0")) + take
                left -= take
                report["concessions"] += 1
                if left <= 0:
                    break

    # Admission sources and enquiries.
    sources = records.setdefault("admission_sources", {})
    wanted = [("SRC-WALKIN", "Direct / walk-in", "walk_in"), ("SRC-WEB", "College website", "website"),
              ("SRC-REF", "Staff / student reference", "referral"), ("SRC-SOCIAL", "Social media", "social_media"),
              ("SRC-NEWS", "Newspaper advertisement", "advertising")]
    for code, label, channel in wanted:
        if code not in sources and not any(s.get("channel") == channel for s in sources.values()):
            sources[code] = {"code": code, "name": label, "channel": channel, "is_active": True, "demo_run": RUN}
            report["sources"] += 1
    by_channel = {s.get("channel"): s["code"] for s in sources.values()}
    enquiries = records.setdefault("admission_enquiries", {})
    if not any(e.get("demo_run") == RUN for e in enquiries.values()):
        programs = records.get("programs", {})
        campus = next(iter(records.get("campuses", {})), None)
        for i in range(24):
            year = years[i % len(years)]
            program = programs.get(year.get("program_code"), {})
            stage = STAGES[i % len(STAGES)]
            first, last = FIRST[i], LAST[i % len(LAST)]
            city, pin = CITIES[i % len(CITIES)]
            created = datetime.now(timezone.utc) - timedelta(days=30 - i)
            channel = ["walk_in", "website", "referral", "social_media", "advertising"][i % 5]
            code = new_code("ENQ")
            enquiries[code] = {
                "code": code, "campus_code": campus, "source_code": by_channel.get(channel) or by_channel.get("walk_in"),
                "program_code": program.get("code"), "first_name": first, "last_name": last,
                "phone": f"98{480 + i:03d}{12000 + i * 37:05d}"[:10], "email": f"{first.lower()}.{last.lower()}{i}@example.com",
                "parent_name": f"{['Srinivas', 'Lakshmi', 'Ramesh', 'Padma'][i % 4]} {last}", "parent_phone": f"99{600 + i:03d}{34000 + i * 41:05d}"[:10],
                "referrer_name": "Rohan Varma" if channel == "referral" else None,
                "assigned_employee_code": staff, "status": "closed" if stage == "joined" else stage,
                "next_follow_up_at": (created + timedelta(days=5 + i % 4)).isoformat() if stage in {"new", "contacted", "counselling", "applied"} else None,
                "communication_consent": i % 5 != 4, "consent_recorded_at": created.isoformat() if i % 5 != 4 else None,
                "created_at": created.isoformat(),
                "course_level": program.get("course_level") or ("degree" if "B" in str(program.get("name", ""))[:1] else "intermediate"),
                "academic_year_code": year["code"], "secondary_phone": None,
                "guardian_relationship": ["father", "mother", "guardian", "father"][i % 4],
                "guardian_mobile": f"99{600 + i:03d}{34000 + i * 41:05d}"[:10],
                "address": {"street": f"{12 + i}-{3 + i % 7}, Main Road", "area": ["Kukatpally", "Dilsukhnagar", "Hanamkonda", "Ameerpet"][i % 4],
                            "city": city, "state": "Telangana", "postal_code": pin},
                "reference_type": {"walk_in": "walk_in", "website": "other", "referral": "staff", "social_media": "social_media",
                                   "advertising": "advertising"}[channel],
                "reference_name": {"referral": "Rohan Varma", "social_media": "Instagram", "advertising": "Eenadu"}.get(channel),
                "workflow_status": "joined" if stage == "joined" else None, "demo_run": RUN}
            report["enquiries"] += 1
    audit(data, None, "demo_admissions_seed", "admission_enquiries", RUN)
    return report


def main():
    store = store_for(Settings())
    try:
        with store.transaction() as data:
            report = apply(data, date.today())
    finally:
        if hasattr(store, "close"):
            store.close()
    if report is None:
        print("No academic years found; run the academic seed first. This file is kept.")
        return
    print(f"Scholarship schemes added:    {report['schemes']}")
    print(f"Student awards added:         {report['awards']}  ({report['concessions']} fee concessions applied)")
    print(f"Admission sources added:      {report['sources']}")
    print(f"Admission enquiries added:    {report['enquiries']}")
    HERE.unlink()
    print(f"Done. {HERE.name} has been deleted.")


if __name__ == "__main__":
    main()
