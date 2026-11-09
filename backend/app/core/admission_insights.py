"""Admissions shown on every home screen: what is open, and reference-based analytics.

Everyone signed in sees the courses open for admission (no personal data). Staff also get
analytics: college-wide figures, plus applicant lists only for roles that may view enquiries.
Each person's own list holds the enquiries assigned to or recorded by them.
"""
from datetime import date

from fastapi import APIRouter, Depends, Request

from . import assignment_workspace as aw
from .security import current_user, has_permission

router = APIRouter(prefix="/admissions/insights", tags=["Admission insights"])
TABLE = "admission_enquiries"
ACTIVE = ("new", "contacted", "counselling", "applied")
REFERENCES = {"walk_in": "Walk-in / direct", "admin": "Admin reference", "teacher": "Teacher reference",
              "employee": "Employee reference", "staff": "Staff reference",
              "relative": "Relative reference", "advertising": "Advertising", "post": "Post / mail",
              "social_media": "Social media", "website": "Website", "referral": "Referral", "other": "Other"}


# References that credit a member of staff (admissions incentives).
STAFF_REFERENCES = {"admin", "teacher", "staff", "employee"}


def creator_reference(data, user):
    """How an enquiry entered by this person is credited: admin, teacher, staff or employee reference."""
    from .edit_approvals import is_super_admin
    person = user.get("person_code")
    records = data["records"]
    employee = records.get("employees", {}).get(person, {}) if user.get("person_type") == "employee" else {}
    name = " ".join(aw.name(employee).split()) or data["accounts"].get(user["code"], {}).get("display_name") \
        or data["accounts"].get(user["code"], {}).get("login_id") or "Admin"
    if is_super_admin(data, user) or user.get("person_type") == "system":
        kind = "admin"
    elif any(t.get("employee_code") == person for t in aw.rows(data, "teachers")):
        kind = "teacher"
    elif any(t.get("employee_code") == person for t in aw.rows(data, "staff_profiles")):
        kind = "staff"
    else:
        kind = "employee"
    return kind, name, (person if employee else None)


def label(key):
    return REFERENCES.get(key) or str(key or "").replace("_", " ").capitalize()


def percent(part, whole):
    return round(part * 100 / whole, 1) if whole else 0


def tally(values):
    counts = {}
    for value in values:
        if value:
            counts[value] = counts.get(value, 0) + 1
    return counts


def ranked(counts, whole, limit=None):
    items = sorted(counts.items(), key=lambda item: (-item[1], str(item[0])))[:limit]
    return [{"name": name, "count": count, "percentage": percent(count, whole)} for name, count in items]


def enquiry_row(data, enquiry):
    records = data["records"]
    program = records.get("programs", {}).get(enquiry.get("program_code"), {})
    source = records.get("admission_sources", {}).get(enquiry.get("source_code"), {})
    # Enquiries from the public form have no reference type; their source says where they came from.
    reference = enquiry.get("reference_type") or source.get("channel") or "other"
    return {"code": enquiry.get("code"),
            "name": " ".join(aw.name(enquiry).split()) or enquiry.get("code"),
            "course_name": program.get("name"),
            "reference_type": reference,
            "reference_label": label(reference),
            "reference_name": enquiry.get("reference_name") or enquiry.get("referrer_name"),
            # Who gets the credit (incentives): the staff member whose reference this is.
            "credited_to": enquiry.get("reference_name") if reference in STAFF_REFERENCES else None,
            "credited_key": (enquiry.get("referrer_employee_code") or enquiry.get("assigned_employee_code")
                             or enquiry.get("referred_by_account") or enquiry.get("reference_name"))
            if reference in STAFF_REFERENCES else None,
            "status": enquiry.get("workflow_status") or enquiry.get("status") or "new",
            "recorded_at": enquiry.get("recorded_at") or enquiry.get("created_at")}


def summarize(rows, referrers=True):
    total = len(rows)
    joined = sum(r["status"] == "joined" for r in rows)
    statuses = tally(r["status"] for r in rows)
    return {"total": total, "joined": joined, "conversion": percent(joined, total),
            "in_progress": sum(r["status"] in ACTIVE for r in rows),
            "not_interested": statuses.get("not_interested", 0),
            "statuses": ranked(statuses, total),
            "courses": ranked(tally(r["course_name"] or "Course not chosen" for r in rows), total, 6),
            "referrers": ranked(tally(r["reference_name"] for r in rows), total, 6) if referrers else []}


def analytics(rows, referrers=True):
    """Totals plus the same figures per reference type, so selecting a type needs no new request."""
    keys = {r["reference_type"] for r in rows}
    groups = [{"key": key, "label": label(key), "share": percent(sum(r["reference_type"] == key for r in rows), len(rows)),
               **summarize([r for r in rows if r["reference_type"] == key], referrers)} for key in keys]
    return {**summarize(rows, referrers), "by_reference": sorted(groups, key=lambda g: (-g["total"], g["label"]))}


def available(data, joined_by_program):
    """Open admission cycles; a college that does not use cycles has every course open."""
    records = data["records"]
    programs = records.get("programs", {})
    years = records.get("academic_years", {})
    cycles = list(records.get("admission_cycles", {}).values())
    today = date.today().isoformat()

    def row(program, **extra):
        code = program.get("code")
        return {"program_code": code, "course_name": program.get("name"), "course_level": program.get("course_level"),
                "intake_capacity": program.get("intake_capacity"), "joined": joined_by_program.get(code, 0),
                "cycle_name": None, "academic_year": None, "closes_on": None, **extra}

    if not cycles:
        items = [row(program) for program in programs.values()]
    else:
        items = []
        for cycle in cycles:
            opens, closes = str(cycle.get("opens_on") or "")[:10], str(cycle.get("closes_on") or "")[:10]
            if (opens and opens > today) or (closes and closes < today):
                continue
            year = years.get(cycle.get("academic_year_code"), {})
            program = programs.get(year.get("program_code"), {})
            items.append(row(program, course_name=program.get("name") or cycle.get("name"), cycle_name=cycle.get("name"),
                             academic_year=year.get("name"), closes_on=closes or None))
    return sorted(items, key=lambda item: str(item["course_name"] or ""))


@router.get("")
def insights(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    enquiries = aw.rows(data, TABLE)
    rows = [enquiry_row(data, e) for e in enquiries]
    joined_by_program = tally(e.get("program_code") for e, r in zip(enquiries, rows) if r["status"] == "joined")
    result = {"available": available(data, joined_by_program), "analytics": None}
    # Students and parents only see what is open: college figures are for staff.
    if user.get("person_type") not in {"employee", "system"}:
        return result
    can_view_all = not aw.teaching(user) and has_permission(data, user, TABLE, "view")
    person, account = user.get("person_code"), user.get("code")
    mine = [r for e, r in zip(enquiries, rows)
            if (person and e.get("assigned_employee_code") == person) or e.get("recorded_by") == account]
    newest = lambda items: sorted(items, key=lambda r: (str(r["recorded_at"] or ""), str(r["code"])), reverse=True)
    result["analytics"] = {"can_view_all": can_view_all,
                           "all": analytics(rows, referrers=can_view_all),
                           "mine": analytics(mine),
                           "all_rows": newest(rows) if can_view_all else [],
                           "my_rows": newest(mine)}
    return result
