"""Course form metadata persists in record_extras alongside existing SQL course columns.

Keep old catalog records untouched; new inputs use years independently of semester count.
"""
from decimal import Decimal, InvalidOperation
from math import ceil

from fastapi import HTTPException


def course_years(program):
    return max(1, ceil(float(program.get("duration_years") or (int(program.get("duration_semesters") or 2) / 2))))


def normalize(data, body, old=None):
    body = dict(body)
    current = {**(old or {}), **body}
    modern = any(k in body for k in ('duration_years', 'semester_labels', 'subject_entries'))
    if modern:
        if current.get('course_level') not in {'intermediate', 'degree'}:
            raise HTTPException(422, 'Select a course level')
        for key in ('qualification', 'branch', 'branch_code'):
            if not str(current.get(key) or '').strip():
                raise HTTPException(422, f'{key.replace("_", " ").title()} is required')
        try:
            years = Decimal(str(current.get('duration_years')))
            if not years.is_finite() or not 0 < years <= 20:
                raise ValueError()
        except (InvalidOperation, ValueError):
            raise HTTPException(422, 'Duration must be between 0 and 20 years')
        count = current.get('duration_semesters')
        if not isinstance(count, int) or not 1 <= count <= 16:
            raise HTTPException(422, 'Enter a semester count between 1 and 16')
        labels = current.get('semester_labels')
        if not isinstance(labels, list) or len(labels) != count or any(not isinstance(x, str) or not x.strip() or len(x) > 100 for x in labels):
            raise HTTPException(422, 'Enter a label for every semester')
        labels = [x.strip() for x in labels]
        if len({x.casefold() for x in labels}) != count:
            raise HTTPException(422, 'Semester labels must be unique')
        body.update(duration_years=str(years), duration_label=f'{years.normalize():f} {"year" if years == 1 else "years"}',
                    semester_labels=labels, semesters_label=str(count))
        if old and count < int(old.get('duration_semesters') or 0):
            if any(r['program_code'] == old['code'] and r['semester_number'] > count for r in data['records'].get('curriculum_subjects', {}).values()):
                raise HTTPException(409, 'Remove subjects from later semesters before reducing the semester count')
        entries = body.get('subject_entries', [])
        if not isinstance(entries, list) or len(entries) > 480:
            raise HTTPException(422, 'Enter at most 480 course subjects')
        seen = set()
        clean = []
        for entry in entries:
            if not isinstance(entry, dict):
                raise HTTPException(422, 'Invalid subject entry')
            name = str(entry.get('name') or '').strip()
            semester = entry.get('semester_number')
            kind = entry.get('subject_type', 'theory')
            if not name or len(name) > 180 or not isinstance(semester, int) or not 1 <= semester <= count or kind not in {'theory', 'practical'}:
                raise HTTPException(422, 'Enter a valid subject name, semester and type')
            key = (semester, name.casefold())
            if key in seen:
                raise HTTPException(422, 'Subject names must be unique within a semester')
            seen.add(key)
            clean.append(dict(name=name, semester_number=semester, subject_type=kind))
        if 'subject_entries' in body:
            body['subject_entries'] = clean
            body['subjects'] = ', '.join(dict.fromkeys(e['name'] for e in clean))
        # Internal name is retained for existing courses, derived for new ones.
        if not old:
            body['name'] = ' · '.join(dict.fromkeys(str(current[k]).strip() for k in ('qualification', 'branch')))
    if not current.get('name') and not body.get('name'):
        raise HTTPException(422, 'Qualification and branch are required')
    if not current.get('department_code'):
        departments = data['records'].setdefault('departments', {})
        level = current.get('course_level') or 'general'
        matching = next((d for d in departments.values() if level in str(d.get('name', '')).lower()), None)
        existing = matching or next(iter(departments.values()), None)
        if existing:
            body['department_code'] = existing['code']
        else:
            campus = next(iter(data['records'].get('campuses', {}).values()), None)
            if not campus:
                raise HTTPException(422, 'Configure a college campus before creating courses')
            code = f'COURSES-{level.upper()}'
            departments[code] = {'code': code, 'campus_code': campus['code'], 'name': f'{level.title()} courses'}
            body['department_code'] = code
    return body


def subject_plan(program):
    return [dict(semester_number=n,
                 subjects=[s['name'] for s in program.get('subject_entries', []) if s['semester_number'] == n and s['subject_type'] == 'theory'],
                 labs=[s['name'] for s in program.get('subject_entries', []) if s['semester_number'] == n and s['subject_type'] == 'practical'])
            for n in range(1, program['duration_semesters'] + 1)]
