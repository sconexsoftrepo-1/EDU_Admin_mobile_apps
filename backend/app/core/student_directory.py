"""Course/batch labels for compact student registers, without changing student records."""


def student_directory_rows(data, students):
    records = data["records"]
    programs = records.get("programs", {})
    batches = records.get("batches", {})
    sections = records.get("sections", {})
    years = records.get("academic_years", {})
    profiles = {p["student_code"]: p for p in records.get("student_admission_profiles", {}).values()}
    enrollments = {}
    for enrollment in sorted(records.get("student_enrollments", {}).values(),
                             key=lambda e: (e.get("status") == "active", str(e.get("enrolled_on") or ""))):
        enrollments[enrollment["student_code"]] = enrollment
    result = []
    # Only consult document metadata for legacy rows that have a key but no view URL.
    photo_keys = {s.get("profile_photo_storage_key") for s in students if s.get("profile_photo_storage_key") and not s.get("profile_photo_url")}
    photos = {d.get("storage_key"): d for d in records.get("documents", {}).values()
              if d.get("storage_key") in photo_keys and not d.get("deleted_at")
              and str(d.get("mime_type") or "").startswith("image/")} if photo_keys else {}
    for student in students:
        profile = profiles.get(student["code"], {})
        enrollment = enrollments.get(student["code"], {})
        section = sections.get(enrollment.get("section_code"), {})
        batch = batches.get(profile.get("batch_code") or section.get("batch_code"), {})
        program = programs.get(profile.get("program_code") or batch.get("program_code"), {})
        year = years.get(profile.get("academic_year_code"), {})
        batch_year = (f"{batch['entry_year']}–{batch['graduation_year']}"
                      if batch.get("entry_year") and batch.get("graduation_year")
                      else batch.get("name") or year.get("name"))
        photo = photos.get(student.get("profile_photo_storage_key"), {})
        photo_url = student.get("profile_photo_url") or (
            f"/api/v1/documents/document/{photo['code']}/view" if photo.get("code") and photo.get("student_code") == student["code"] else None)
        result.append({**student,
            "student_name": " ".join(str(student[k]) for k in ("first_name", "middle_name", "last_name") if student.get(k)),
            "course_name": program.get("name"), "batch_year": batch_year,
            "course_level": program.get("course_level") or profile.get("course_level") or student.get("course_level"),
            "branch": program.get("branch") or profile.get("branch") or program.get("name"),
            "profile_photo_url": photo_url})
    return result


def filter_student_directory(students, filters, search=""):
    """Apply combined column filters before pagination, across the complete register."""
    filters = {key: str(value).strip().casefold() for key,value in filters.items() if str(value).strip()}
    search = search.strip().casefold()
    fields = ("student_name", "admission_number", "university_registration_number", "course_level", "course_name", "batch_year", "email")
    return [student for student in students
            if all(value in str(student.get(key) or "").casefold() for key,value in filters.items())
            and (not search or any(search in str(student.get(key) or "").casefold() for key in fields))]


def set_filter_student_directory(students, filters):
    """OR within a column's selected values, AND across active column filters."""
    normalized = {key: {str(value).casefold() for value in values} for key,values in filters.items()}
    return [student for student in students if all(str(student.get(key) or "").casefold() in values
                                                  for key,values in normalized.items())]


def student_filter_options(students):
    columns = ("student_name", "admission_number", "university_registration_number", "course_level", "course_name", "batch_year")
    return {key: sorted({str(student.get(key) or "") for student in students},key=str.casefold) for key in columns}
