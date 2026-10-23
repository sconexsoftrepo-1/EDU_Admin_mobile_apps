"""Load the college's course catalog: Intermediate groups and non-medical degree courses.

Each course becomes a programme (programs) with its level (intermediate/degree), branch,
course family (category), duration, semesters, career opportunities and, for Intermediate, the
subjects; each course family gets a department. Running the tool again refreshes the details of
existing courses and adds new ones (courses are matched by code, so edits made in the dashboard
to other fields are kept). When the database has no campus yet, an institution and a main campus
are created first (rename them in Settings).

    python tools/seed_course_catalog.py
    python tools/seed_course_catalog.py --institution "EduNexa College" --campus "Main Campus"
"""

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.settings import Settings
from app.core.storage import audit
from app.modules.master_data.onboarding.api import create
from create_master_data_role import store_for

INTERMEDIATE = [
    # code, group, name, subjects, careers
    ("INT-MPC", "MPC", "Intermediate MPC", "Mathematics, Physics, Chemistry and languages",
     "BCA, B.Sc Computer Science, B.Sc Mathematics, B.Sc Data Science, BBA, and eligible architecture or other "
     "professional programmes"),
    ("INT-BPC", "BPC", "Intermediate BPC", "Biology (Botany and Zoology), Physics, Chemistry and languages",
     "B.Sc Botany, Zoology, Biotechnology, Microbiology, Environmental Science, Agriculture, Horticulture, "
     "Food Science and other life-science programmes"),
    ("INT-MEC", "MEC", "Intermediate MEC", "Mathematics, Economics, Commerce and languages",
     "B.Com, BBA, BCA where eligible, Economics, Finance, Business Analytics and Actuarial Science"),
    ("INT-CEC", "CEC", "Intermediate CEC", "Civics or Political Science, Economics, Commerce and languages",
     "B.Com, BBA, BA, Law, Journalism, Public Administration and Civil Services preparation"),
    ("INT-HEC", "HEC", "Intermediate HEC", "History, Economics, Civics and languages",
     "BA, Social Work, Journalism, Political Science, Law and Public Administration"),
    ("INT-VOC", "Vocational", "Intermediate Vocational",
     "Computer applications, office administration, accounting, web applications, business administration "
     "and selected technical skills",
     "Relevant vocational degrees, BCA where eligible, B.Com, BBA and entry-level employment"),
]

# Course family -> [(degree course, duration, semesters, career opportunities)]
DEGREES = {
    "Arts, Humanities and Social Sciences": [
        ("BA General", "3–4 years", "6–8", "Government exams, administration"),
        ("BA English", "3–4 years", "6–8", "Content writing, editing, publishing"),
        ("BA History", "3–4 years", "6–8", "Research, museums, civil services"),
        ("BA Political Science", "3–4 years", "6–8", "Public policy, civil services"),
        ("BA Economics", "3–4 years", "6–8", "Banking, economic research"),
        ("BA Sociology", "3–4 years", "6–8", "Social research, NGOs"),
        ("BA Psychology", "3–4 years", "6–8", "HR, research, further psychology study"),
        ("BA Geography", "3–4 years", "6–8", "GIS, planning, environmental research"),
        ("BA Philosophy", "3–4 years", "6–8", "Research, writing, education"),
        ("BA Public Administration", "3–4 years", "6–8", "Administration, policy support"),
        ("BA Journalism and Mass Communication", "3–4 years", "6–8", "Journalism, media, PR"),
        ("Bachelor of Social Work (BSW)", "3–4 years", "6–8", "Social work, NGO management"),
        ("Bachelor of Fine Arts (BFA)", "3–4 years", "6–8", "Artist, illustrator"),
        ("BA Languages", "3–4 years", "6–8", "Translation, teaching, publishing"),
        ("BA Defence Studies", "3–4 years", "6–8", "Defence research, policy analysis"),
        ("BA International Relations", "3–4 years", "6–8", "Policy research, international affairs"),
        ("BA Development Studies", "3–4 years", "6–8", "Development projects, research"),
        ("BA Criminology", "3–4 years", "6–8", "Crime research, correctional services"),
    ],
    "Commerce, Finance and Management": [
        ("B.Com General", "3–4 years", "6–8", "Accountant, accounts executive"),
        ("B.Com Honours", "3–4 years", "6–8", "Financial analyst, accounting"),
        ("B.Com Accounting and Finance", "3–4 years", "6–8", "Audit, finance, accounting"),
        ("B.Com Banking and Insurance", "3–4 years", "6–8", "Banking, insurance operations"),
        ("B.Com Computer Applications", "3–4 years", "6–8", "ERP support, accounting systems"),
        ("B.Com Taxation", "3–4 years", "6–8", "Tax assistant, compliance"),
        ("BBA", "3–4 years", "6–8", "Management, business development"),
        ("BBA Finance", "3–4 years", "6–8", "Finance, banking"),
        ("BBA Marketing", "3–4 years", "6–8", "Marketing, sales"),
        ("BBA Human Resources", "3–4 years", "6–8", "HR, recruitment"),
        ("BBA International Business", "3–4 years", "6–8", "International trade, exports"),
        ("BBA Business Analytics", "3–4 years", "6–8", "Business analyst, reporting analyst"),
        ("Bachelor of Management Studies (BMS)", "3–4 years", "6–8", "Operations, management"),
        ("Bachelor of Actuarial Science", "3–4 years", "6–8", "Actuarial analyst after relevant exams"),
        ("Bachelor of Insurance and Risk Management", "3–4 years", "6–8", "Insurance, risk analysis"),
        ("Bachelor of Real Estate Management", "3–4 years", "6–8", "Property management, valuation"),
    ],
    "Science and Computer Applications": [
        ("B.Sc Mathematics", "3–4 years", "6–8", "Data analysis, quantitative research"),
        ("B.Sc Physics", "3–4 years", "6–8", "Research, laboratory work"),
        ("B.Sc Chemistry", "3–4 years", "6–8", "Chemical testing, quality control"),
        ("B.Sc Statistics", "3–4 years", "6–8", "Statistics, data analytics"),
        ("B.Sc Computer Science", "3–4 years", "6–8", "Software development"),
        ("B.Sc Information Technology", "3–4 years", "6–8", "IT, systems administration"),
        ("B.Sc Data Science", "3–4 years", "6–8", "Data analyst, junior data scientist"),
        ("B.Sc Artificial Intelligence", "3–4 years", "6–8", "AI development, machine learning"),
        ("B.Sc Cybersecurity", "3–4 years", "6–8", "Security analyst"),
        ("B.Sc Cloud Computing", "3–4 years", "6–8", "Cloud support, cloud engineering"),
        ("B.Sc Software Development", "3–4 years", "6–8", "Software development, testing"),
        ("B.Sc Mathematics and Computing", "3–4 years", "6–8", "Computing, analytics"),
        ("B.Sc Electronics", "3–4 years", "6–8", "Electronics testing, technical support"),
        ("B.Sc Geology", "3–4 years", "6–8", "Geological research, mining sector"),
        ("B.Sc Environmental Science", "3–4 years", "6–8", "Environmental analysis"),
        ("B.Sc Botany", "3–4 years", "6–8", "Plant research, conservation"),
        ("B.Sc Zoology", "3–4 years", "6–8", "Wildlife research, conservation"),
        ("B.Sc Biotechnology", "3–4 years", "6–8", "Biotechnology research and industry"),
        ("B.Sc Microbiology", "3–4 years", "6–8", "Industrial microbiology, laboratory research"),
        ("B.Sc Food Science and Technology", "3–4 years", "6–8", "Food production, quality assurance"),
        ("BCA", "3–4 years", "6–8", "Software developer, web developer"),
        ("BCA Artificial Intelligence and ML", "3–4 years", "6–8", "AI/ML associate"),
        ("BCA Data Analytics", "3–4 years", "6–8", "Data analyst, BI developer"),
        ("BCA Cybersecurity", "3–4 years", "6–8", "Cybersecurity operations"),
        ("BCA Cloud Computing", "3–4 years", "6–8", "Cloud support, infrastructure"),
        ("BCA Game Development", "3–4 years", "6–8", "Game developer"),
        ("BCA UI/UX and Multimedia", "3–4 years", "6–8", "UI designer, UX associate"),
        ("Bachelor of Information Systems", "3–4 years", "6–8", "Business systems analyst, ERP consultant"),
    ],
    "Law and Legal Studies": [
        ("BA LLB", "5 years", "Usually 10", "Legal practice, legal research"),
        ("BBA LLB", "5 years", "Usually 10", "Corporate law, compliance"),
        ("B.Com LLB", "5 years", "Usually 10", "Commercial law, taxation-related legal work"),
        ("B.Sc LLB", "5 years", "Usually 10", "Legal research, litigation"),
        ("BLS LLB", "5 years", "Usually 10", "Legal practice, legal services"),
        ("LLB after graduation", "3 years", "6", "Advocacy, legal associate"),
    ],
    "Design, Architecture and Creative Arts": [
        ("B.Des", "4 years", "8", "Product, communication and digital design"),
        ("B.Des UI/UX", "Usually 4 years", "8", "UI/UX designer"),
        ("B.Des Product Design", "Usually 4 years", "8", "Product designer"),
        ("B.Des Fashion Design", "Usually 4 years", "8", "Fashion designer"),
        ("B.Des Interior Design", "Usually 4 years", "8", "Interior designer"),
        ("B.Des Animation and VFX", "3–4 years", "6–8", "Animator, VFX artist"),
        ("Bachelor of Visual Arts", "3–4 years", "6–8", "Visual artist, creative professional"),
        ("Bachelor of Performing Arts", "3–4 years", "6–8", "Music, dance, theatre"),
        ("Bachelor of Film and Television Production", "3–4 years", "6–8", "Film production, editing"),
        ("Bachelor of Photography", "3–4 years", "6–8", "Photographer, content creator"),
        ("Bachelor of Animation", "3–4 years", "6–8", "Animator, motion designer"),
        ("Bachelor of Fashion Technology", "Usually 4 years", "8", "Apparel production, fashion technology"),
        ("Bachelor of Textile Design", "3–4 years", "6–8", "Textile and print design"),
        ("B.Arch", "5 years", "Usually 10", "Architect after required registration"),
        ("Bachelor of Planning (B.Plan)", "Usually 4 years", "8", "Urban planning, transport planning"),
    ],
    "Agriculture and Related Non-Medical Fields": [
        ("B.Sc Agriculture", "4 years", "Usually 8", "Agriculture officer through relevant recruitment, agronomist"),
        ("B.Sc Horticulture", "4 years", "Usually 8", "Horticulturist, nursery management"),
        ("B.Sc Forestry", "Usually 4 years", "Usually 8", "Forestry, conservation"),
        ("Bachelor of Fisheries Science (B.F.Sc)", "Usually 4 years", "Usually 8", "Fisheries, aquaculture"),
        ("B.Sc Sericulture", "3–4 years", "6–8", "Silk production, sericulture"),
        ("B.Sc Agribusiness Management", "3–4 years", "6–8", "Agribusiness, procurement"),
        ("B.Sc Agricultural Economics", "3–4 years", "6–8", "Agricultural market analysis"),
        ("B.Sc Plant Biotechnology", "3–4 years", "6–8", "Plant research, biotechnology"),
        ("Bachelor of Food Technology", "3–4 years, depending on programme", "6–8", "Food processing, quality control"),
        ("Bachelor of Dairy Technology", "Usually 4 years", "Usually 8", "Dairy production, processing"),
    ],
    "Hospitality, Tourism, Aviation and Logistics": [
        ("Bachelor of Hotel Management (BHM)", "3–4 years", "6–8", "Hotel operations, hospitality"),
        ("B.Sc Hospitality and Hotel Administration", "Usually 3 years", "6", "Hotel management, front office"),
        ("Bachelor of Tourism Administration", "3–4 years", "6–8", "Tourism operations"),
        ("BBA Tourism and Travel Management", "3–4 years", "6–8", "Travel management"),
        ("Bachelor of Event Management", "3–4 years", "6–8", "Event coordination"),
        ("Bachelor of Culinary Arts", "3–4 years", "6–8", "Chef, kitchen management"),
        ("Bachelor of Aviation Management", "3–4 years", "6–8", "Airport operations"),
        ("B.Sc Aviation", "Usually 3 years", "6", "Aviation operations"),
        ("BBA Logistics and Supply Chain Management", "3–4 years", "6–8", "Logistics, procurement"),
        ("Bachelor of Shipping and Port Management", "3–4 years", "6–8", "Shipping and port operations"),
        ("Bachelor of Maritime Studies", "Programme-dependent", "Varies", "Maritime operations"),
    ],
    "Education and Teaching": [
        ("Bachelor of Elementary Education (B.El.Ed)", "4 years", "8", "Elementary teaching, subject to eligibility"),
        ("Integrated BA B.Ed", "Usually 4 years in approved pathways", "8", "School teaching"),
        ("Integrated B.Sc B.Ed", "Usually 4 years in approved pathways", "8", "Science teaching"),
        ("B.Ed", "Programme-dependent", "Varies", "Teaching after required qualifications"),
        ("Bachelor of Physical Education (B.P.Ed)", "Commonly 2 years after graduation", "4", "Physical education, coaching"),
        ("Bachelor of Sports Science", "3–4 years", "6–8", "Sports performance, fitness"),
        ("Bachelor of Sports Management", "3–4 years", "6–8", "Sports administration"),
        ("Bachelor of Library and Information Science (BLIS)", "Commonly 1 year after graduation", "Varies",
         "Library and information services"),
    ],
    "Vocational and Industry-Oriented Degrees": [
        ("B.Voc Software Development", "Usually 3 years", "6", "Junior developer"),
        ("B.Voc Banking and Finance", "Usually 3 years", "6", "Banking operations"),
        ("B.Voc Retail Management", "Usually 3 years", "6", "Retail operations"),
        ("B.Voc Automobile Servicing", "Usually 3 years", "6", "Automotive service"),
        ("B.Voc Renewable Energy", "Usually 3 years", "6", "Solar and renewable energy"),
        ("B.Voc Food Processing", "Usually 3 years", "6", "Food production"),
        ("B.Voc Logistics", "Usually 3 years", "6", "Warehouse and supply chain"),
        ("B.Voc Animation and Multimedia", "Usually 3 years", "6", "Animation and digital media"),
        ("B.Voc Tourism and Hospitality", "Usually 3 years", "6", "Tourism and hospitality"),
        ("Bachelor of Construction Management", "3–4 years", "6–8", "Construction project coordination"),
        ("Bachelor of Packaging Technology", "3–4 years", "6–8", "Packaging design and quality"),
        ("Bachelor of Disaster Management", "3–4 years", "6–8", "Emergency planning, disaster response"),
    ],
}
NOTES = {
    "Law and Legal Studies": "Legal practice requires meeting the applicable professional enrolment requirements.",
}
FAMILIES = ["B.Com", "B.Sc", "B.Des", "B.Voc", "BCA", "BBA", "BA"]  # longest prefixes first


def slug(text):
    return re.sub(r"[^A-Z0-9]+", "-", text.upper()).strip("-")


def qualification_and_branch(name, category):
    """'BA English' -> ('BA', 'English'); 'BBA' -> ('BBA', 'General'); other titles keep their name."""
    if category != "Law and Legal Studies":
        for family in FAMILIES:
            if name == family:
                return family, "General"
            if name.startswith(family + " "):
                return family, name[len(family) + 1:]
    return name, None


def semesters(duration, label):
    found = re.search(r"\d+", label)
    if found:
        return int(found.group())
    years = re.search(r"\d+", duration)
    return int(years.group()) * 2 if years else 6


def catalog():
    """Every course as programme values (without department), in catalog order."""
    courses = []
    for code, group, name, subjects, careers in INTERMEDIATE:
        courses.append(("Intermediate (Class 11 and 12)", {
            "code": code, "name": name, "qualification": "Intermediate", "course_level": "intermediate",
            "branch": group, "category": "Intermediate", "duration_label": "2 years",
            "semesters_label": "4 (1-1, 1-2, 2-1, 2-2)", "duration_semesters": 4,
            "subjects": subjects, "career_opportunities": careers}))
    seen = set()
    for category, rows in DEGREES.items():
        for name, duration, label, careers in rows:
            if name.casefold() in seen:  # e.g. BFA is listed under two families
                continue
            seen.add(name.casefold())
            qualification, branch = qualification_and_branch(name, category)
            courses.append((category, {
                "code": f"DEG-{slug(name)}"[:100], "name": name, "qualification": qualification,
                "course_level": "degree", "branch": branch, "category": category, "duration_label": duration,
                "semesters_label": label, "duration_semesters": semesters(duration, label),
                "career_opportunities": careers + (f". {NOTES[category]}" if category in NOTES else "")}))
    return courses


def ensure_campus(data, institution_name, campus_name, actor):
    campuses = list(data["records"].get("campuses", {}).values())
    if campuses:
        return campuses[0]["code"]
    institutions = list(data["records"].get("institutions", {}).values())
    institution = institutions[0]["code"] if institutions else create(
        data, "institutions", {"code": "INST-" + slug(institution_name)[:40], "name": institution_name}, actor)["code"]
    return create(data, "campuses", {"code": "CAMP-" + slug(campus_name)[:40], "institution_code": institution,
                                     "name": campus_name}, actor)["code"]


def ensure_department(data, name, campus, actor):
    departments = data["records"].setdefault("departments", {})
    found = next((d for d in departments.values() if str(d.get("name", "")).casefold() == name.casefold()), None)
    if found:
        return found["code"]
    return create(data, "departments", {"code": "DEP-" + slug(name)[:50], "name": name, "campus_code": campus},
                  actor)["code"]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--institution", default="EduNexa College", help="institution created when none exists")
    parser.add_argument("--campus", default="Main Campus", help="campus created when none exists")
    args = parser.parse_args()
    store = store_for(Settings())
    created = updated = 0
    with store.transaction() as data:
        campus = ensure_campus(data, args.institution, args.campus, "system")
        programs = data["records"].setdefault("programs", {})
        details = ("name", "qualification", "course_level", "branch", "category", "duration_label",
                   "semesters_label", "duration_semesters", "subjects", "career_opportunities")
        for department_name, values in catalog():
            department = ensure_department(data, department_name, campus, "system")
            existing = programs.get(values["code"])
            if existing is None:
                create(data, "programs", {**values, "department_code": department}, "system")
                created += 1
            elif any(existing.get(k) != values.get(k) for k in details if k in values):
                existing.update({k: values[k] for k in details if k in values})
                audit(data, "system", "edit", "programs", values["code"])
                updated += 1
    if hasattr(store, "close"):
        store.close()
    print(f"Courses created: {created}, updated: {updated}; {len(catalog())} in the catalog")


if __name__ == "__main__":
    main()
