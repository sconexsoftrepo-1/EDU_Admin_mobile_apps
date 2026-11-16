"""Student and parent access to the EduNest app.

- Login ID = the student's admission number (the reference number generated at enrollment also works).
- At enrollment the student and the parents receive a welcome email (course, branch, login ID, app link,
  what the app does, how to sign in the first time).
- First sign-in: login ID + registered email -> a 6-digit code by email -> create password.
  The student account and the linked parents' accounts get that password, and each parent receives an
  email with the login ID and password (the college's chosen flow). Parents then sign in with the same
  login ID and password, choosing "Parent" in the app.
"""

import hashlib
import hmac
import secrets
import time
from html import escape
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from pydantic import Field, model_validator

from . import email_layout as layout
from .email_delivery import send_email
from .security import StrictModel, digest, hasher, issue
from .storage import audit, new_code

router = APIRouter(prefix="/auth/first-time", tags=["Authentication"])

COLLEGE = layout.COLLEGE
APP_NAME = "EduNest"
CODE_MINUTES = 10
MAX_TRIES = 5
RESEND_SECONDS = 60
PER_HOUR = 5
NEUTRAL = ("If the login ID and email match our records, a 6-digit code has been sent to that email. "
           "It is valid for 10 minutes.")


# ----------------------------------------------------------------------------- lookups

def rows(data, table):
    return list(data["records"].get(table, {}).values())


def find_student(data, login):
    """The student whose admission number, reference number or student code is ``login``."""
    wanted = str(login or "").strip().casefold()
    if not wanted:
        return None
    students = data["records"].get("students", {})
    for student in students.values():
        if str(student.get("admission_number") or "").casefold() == wanted or student["code"].casefold() == wanted:
            return student
    for profile in rows(data, "student_admission_profiles"):
        if str(profile.get("reference_number") or "").casefold() == wanted:
            return students.get(profile.get("student_code"))
    return None


def login_id_of(student):
    return str(student.get("admission_number") or student["code"])


def parents_of(data, student_code):
    """Linked parents (with their link), primary first."""
    parents = data["records"].get("parents", {})
    links = sorted((l for l in rows(data, "student_parents") if l.get("student_code") == student_code),
                   key=lambda l: not l.get("is_primary"))
    return [(parents[l["parent_code"]], l) for l in links if l.get("parent_code") in parents]


def account_of(data, person_type, person_code):
    return next((a for a in data["accounts"].values()
                 if a.get("person_type") == person_type and a.get("person_code") == person_code), None)


def parent_accounts_for_login(data, login):
    """Parent sign-in with the child's login ID: the active accounts of that student's parents."""
    student = find_student(data, login)
    if not student:
        return []
    found = [account_of(data, "parent", p["code"]) for p, _ in parents_of(data, student["code"])]
    return [a for a in found if a and a.get("active")]


def student_account_for_login(data, login):
    student = find_student(data, login)
    return account_of(data, "student", student["code"]) if student else None


def name_of(person):
    return " ".join(filter(None, [person.get("first_name"), person.get("last_name")])).strip() or "Student"


def course_of(data, student_code):
    """(course name, branch) from the enrollment profile."""
    profile = next((p for p in rows(data, "student_admission_profiles") if p.get("student_code") == student_code), {})
    program = data["records"].get("programs", {}).get(profile.get("program_code"), {})
    return program.get("name") or "your course", program.get("branch") or ""


def email_in_use(data, email, except_code=None):
    return any(a.get("code") != except_code and (a.get("email") or "").casefold() == email.casefold()
               for a in data["accounts"].values())


# ----------------------------------------------------------------------------- emails

FEATURES = [
    ("Academics", "class timetable, daily attendance, internal marks and results, assignments, syllabus and "
                  "study resources"),
    ("Fees and payments", "semester fee details and dues, secure online payment, complete payment history and "
                          "downloadable receipts, with reminders before every due date"),
    ("Chats", "direct messages with faculty and the college office"),
    ("Updates", "college announcements, academic calendar, leave requests and certificate requests"),
]


def app_link(settings):
    return getattr(settings, "student_app_link", None) or None


def app_link_text(settings):
    link = app_link(settings)
    return (f"Download {APP_NAME} from the Google Play Store: {link}" if link else
            f"The {APP_NAME} app will be available on the Google Play Store shortly. "
            "We will share the download link with you as soon as it is published.")


def _app_block_html(settings):
    link = app_link(settings)
    return layout.button(f"Download {APP_NAME} on Google Play", link) if link else layout.notice(app_link_text(settings))


def _text_features():
    return "\n".join(f"  - {t}: {d}" for t, d in FEATURES)


def _text_steps(items):
    return "\n".join(f"  {i}. {s}" for i, s in enumerate(items, 1))


def welcome_email(settings, recipient_name, student, course, branch, for_parent):
    login = login_id_of(student)
    child = name_of(student)
    course_line = course + (f" ({branch})" if branch else "")
    role = "Parent" if for_parent else "Student"
    subject = f"Welcome to {COLLEGE} - Admission confirmed for {child}"
    title = f"Welcome to {COLLEGE}"
    opening = (f"Thank you for choosing {COLLEGE} for the education of your ward {child}. We are pleased to confirm "
               f"the admission to {course_line}." if for_parent else
               f"Congratulations, and thank you for choosing {COLLEGE}. We are pleased to confirm your admission to "
               f"{course_line}.")
    middle = (f"As a parent, you can follow {child}'s progress, attendance and fees, and stay in touch with the "
              f"college through {APP_NAME}, our official app for students and parents."
              if for_parent else
              f"Your academic life at the college is managed through {APP_NAME}, our official app for students "
              "and parents.")
    first = [f"Install {APP_NAME} and choose {role} on the first screen.",
             "Tap 'First time? Create your password'.",
             f"Enter the login ID {login} and your email address registered with the college.",
             "Enter the 6-digit verification code we email you, then create your password."]
    rows = [("Student name", child), ("Course", course_line), ("Login ID", login)]
    html = layout.page(settings, title, f"Admission confirmed - your {APP_NAME} login ID is {login}",
                       layout.p(f"Dear {escape(recipient_name)},") + layout.p(escape(opening))
                       + layout.details(rows)
                       + layout.p(escape(middle)) + layout.heading(f"What you can do in {APP_NAME}")
                       + layout.bullets(FEATURES) + layout.heading("Getting the app") + _app_block_html(settings)
                       + layout.heading("First sign-in") + layout.steps(first)
                       + layout.p("We look forward to a rewarding academic journey together."))
    text = layout.text_page(title, (
        f"Dear {recipient_name},\n\n{opening}\n\n  Student name: {child}\n  Course: {course_line}\n  Login ID: {login}\n\n"
        f"{middle}\n\nWhat you can do in {APP_NAME}:\n{_text_features()}\n\nGetting the app:\n  {app_link_text(settings)}\n\n"
        f"First sign-in:\n{_text_steps(first)}\n\nWe look forward to a rewarding academic journey together."))
    return subject, text, html


def welcome_emails(data, settings, student_code):
    """Emails for a newly enrolled student and each linked parent (one per address)."""
    student = data["records"]["students"][student_code]
    course, branch = course_of(data, student_code)
    out, seen = [], set()
    if student.get("email"):
        out.append((student["email"], *welcome_email(settings, name_of(student), student, course, branch, False)))
        seen.add(student["email"].casefold())
    for parent, link in parents_of(data, student_code):
        email = parent.get("email")
        if email and link.get("receives_notifications", True) and email.casefold() not in seen:
            out.append((email, *welcome_email(settings, name_of(parent), student, course, branch, True)))
            seen.add(email.casefold())
    return out


def send_all(settings, messages):
    for to, subject, text, html in messages:
        send_email(settings, to, subject, text, html)


def credentials_email(settings, parent, student, password):
    login = login_id_of(student)
    child = name_of(student)
    subject = f"Your {APP_NAME} parent login for {child}"
    title = f"Your {APP_NAME} parent login is ready"
    opening = (f"{child} has completed the {APP_NAME} account set-up. You can now use the same login to follow "
               "academics, attendance, fees and payments, and to stay in touch with the college.")
    howto = f"Open {APP_NAME}, choose Parent on the first screen, and sign in with the details below."
    care = ("Please keep these details confidential. The password is shared with your ward; "
            "it can be changed at any time from the Profile section of the app.")
    html = layout.page(settings, title, f"Sign in to {APP_NAME} with login ID {login}",
                       layout.p(f"Dear {escape(name_of(parent))},") + layout.p(escape(opening)) + layout.p(escape(howto))
                       + layout.details([("Login ID", login), ("Password", password), ("Sign in as", "Parent")])
                       + layout.notice(care) + layout.heading("Getting the app") + _app_block_html(settings)
                       + layout.heading(f"What you can do in {APP_NAME}") + layout.bullets(FEATURES))
    text = layout.text_page(title, (
        f"Dear {name_of(parent)},\n\n{opening}\n\n{howto}\n\n  Login ID: {login}\n  Password: {password}\n"
        f"  Sign in as: Parent\n\n{care}\n\nGetting the app:\n  {app_link_text(settings)}\n\n"
        f"What you can do in {APP_NAME}:\n{_text_features()}"))
    return subject, text, html


def code_email(settings, name, code):
    subject = f"{code} is your {APP_NAME} verification code"
    title = "Verify your email address"
    lines = (f"Use the verification code below to create your {APP_NAME} password. "
             f"The code is valid for {CODE_MINUTES} minutes.")
    care = ("Never share this code with anyone, including college staff. "
            "If you did not request it, you can safely ignore this email.")
    html = layout.page(settings, title, f"Your verification code is {code}",
                       layout.p(f"Dear {escape(name)},") + layout.p(escape(lines)) + layout.code_box(code)
                       + layout.notice(care))
    text = layout.text_page(title, f"Dear {name},\n\n{lines}\n\n    Verification code: {code}\n\n{care}")
    return subject, text, html


# ----------------------------------------------------------------------------- first sign-in

class SetupRequest(StrictModel):
    login_id: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    client: Literal["student-mobile", "parent-mobile"]


class SetupVerify(SetupRequest):
    code: str = Field(pattern=r"^\d{6}$")
    password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def strong_enough(self):
        if not (any(c.isalpha() for c in self.password) and any(c.isdigit() for c in self.password)):
            raise ValueError("Use at least 8 characters with letters and numbers")
        return self


def requester(data, body):
    """(student, person dict, person_type) when the email belongs to that student (student app) or
    one of the student's parents (parent app)."""
    student = find_student(data, body.login_id)
    if not student or student.get("status") not in (None, "active"):
        return None
    email = body.email.strip().casefold()
    if body.client == "student-mobile":
        return (student, student, "student") if (student.get("email") or "").casefold() == email else None
    parent = next((p for p, _ in parents_of(data, student["code"]) if (p.get("email") or "").casefold() == email), None)
    return (student, parent, "parent") if parent else None


def code_hash(settings, key, code):
    return hmac.new(settings.jwt_secret.encode(), f"setup:{key}:{code}".encode(), hashlib.sha256).hexdigest()


def store(data):
    return data.setdefault("documents", {}).setdefault("account_setup_codes", {})


@router.post("/request")
def request_setup_code(body: SetupRequest, request: Request, response: Response, background: BackgroundTasks):
    response.headers["Cache-Control"] = "no-store"
    settings = request.app.state.settings
    now = time.time()
    outgoing = None
    ip_key = "setup-ip:" + digest(request.client.host if request.client else "unknown")
    with request.app.state.store.transaction() as data:
        attempts = data["login_attempts"]
        attempts[ip_key] = [t for t in attempts.get(ip_key, []) if t > now - 3600]
        if len(attempts[ip_key]) >= 30:
            raise HTTPException(429, "Too many requests. Try again later.", headers={"Retry-After": "3600"})
        attempts[ip_key].append(now)
        found = requester(data, body)
        if found:
            student, person, kind = found
            key = f"{body.client}:{student['code']}"
            entry = store(data).get(key, {})
            sent = [t for t in entry.get("sent", []) if t > now - 3600]
            if (not sent or now - sent[-1] >= RESEND_SECONDS) and len(sent) < PER_HOUR:
                code = f"{secrets.randbelow(1_000_000):06d}"
                store(data)[key] = {"hash": code_hash(settings, key, code), "email": body.email.strip().casefold(),
                                    "expires": now + CODE_MINUTES * 60, "tries": 0, "sent": sent + [now]}
                outgoing = (person["email"], *code_email(settings, name_of(person), code))
    if outgoing:
        background.add_task(send_email, settings, *outgoing)
    return {"sent": True, "message": NEUTRAL}


def ensure_account(data, kind, person, login_id, password_hash):
    """Create or update the EduNest account of a student or parent with this password."""
    role, client = ("STUDENT", "student-mobile") if kind == "student" else ("PARENT", "parent-mobile")
    account = account_of(data, kind, person["code"])
    email = (person.get("email") or "").strip().lower() or None
    if account is None:
        code = new_code("USR")
        account = {"code": code, "login_id": login_id, "person_type": kind, "person_code": person["code"],
                   "role_codes": [role], "clients": [client], "active": True}
        data["accounts"][code] = account
    account.update(password_hash=password_hash, active=True)
    if email and not account.get("email") and not email_in_use(data, email, account["code"]):
        account["email"] = email
    return account


@router.post("/verify")
def verify_setup(body: SetupVerify, request: Request, response: Response, background: BackgroundTasks):
    response.headers["Cache-Control"] = "no-store"
    settings = request.app.state.settings
    now = time.time()
    result, error, outgoing = None, None, []
    with request.app.state.store.transaction() as data:
        found = requester(data, body)
        key = f"{body.client}:{found[0]['code']}" if found else None
        entry = store(data).get(key) if key else None
        if not entry or not entry.get("hash") or entry.get("expires", 0) < now \
                or entry.get("email") != body.email.strip().casefold():
            error = "The code is wrong or has expired. Request a new code."
        elif not hmac.compare_digest(entry["hash"], code_hash(settings, key, body.code)):
            entry["tries"] = entry.get("tries", 0) + 1
            if entry["tries"] >= MAX_TRIES:
                entry.update(hash="", expires=0)
            error = "The code is wrong or has expired. Request a new code."
        else:
            entry.update(hash="", expires=0)
            student, person, kind = found
            login = login_id_of(student)
            if any(a["login_id"].casefold() == login.casefold() and not (a.get("person_type") == "student"
                   and a.get("person_code") == student["code"]) for a in data["accounts"].values()):
                raise HTTPException(409, "This login ID is already used by another account; contact the college office")
            password_hash = hasher.hash(body.password)
            student_account = ensure_account(data, "student", student, login, password_hash)
            signed_in = student_account
            for parent, link in parents_of(data, student["code"]):
                parent_account = ensure_account(data, "parent", parent, f"{login}-P-{parent['code']}", password_hash)
                if kind == "parent" and parent["code"] == person["code"]:
                    signed_in = parent_account
                if parent.get("email") and link.get("receives_notifications", True):
                    outgoing.append((parent["email"], *credentials_email(settings, parent, student, body.password)))
            audit(data, signed_in["code"], "account_setup", "accounts", signed_in["code"])
            result = issue(data, signed_in, body.client, settings)
            result["roles"] = [data["roles"][r] for r in signed_in["role_codes"] if r in data["roles"]]
    if error:
        raise HTTPException(401, error)
    for message in outgoing:
        background.add_task(send_email, settings, *message)
    return result
