import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from seed_linked_academics import populate
from app.core.curriculum_workspace import insert, starter, student_subjects


def test_student_subjects_carry_course_year_and_faculty(app):
    with app.state.store.transaction() as d:
        def put(t, c, **v): d['records'].setdefault(t, {})[c] = {'code': c, **v}
        put('institutions', 'I', name='Pragathi College')
        put('campuses', 'C', institution_code='I', name='Main')
        put('departments', 'D', campus_code='C', name='Academics')
        for i, (name, duration) in enumerate([('Intermediate BPC', 4), ('Intermediate MPC', 4), ('BCA', 6), ('B.Com General', 6)]):
            p = {'code': f'P{i}', 'name': name, 'department_code': 'D', 'duration_semesters': duration,
                 'course_level': 'intermediate' if i < 2 else 'degree'}
            d['records'].setdefault('programs', {})[p['code']] = p
            insert(d, p, starter(p), True)
        populate(d, 'test@123')
        bca = [b for b in d['records'].get('batches', {}).values() if b.get('program_code') == 'P2']
        sections = {s['code'] for s in d['records']['sections'].values() if s.get('batch_code') in {b['code'] for b in bca}}
        student = sorted(e['student_code'] for e in d['records']['student_enrollments'].values() if e['section_code'] in sections)[0]
        rows = student_subjects(d, {student})
    assert rows, 'the student has current-semester subjects'
    first = rows[0]
    assert first['program_name'] == 'BCA'
    assert first['academic_year_name'] and first['current_semester'] == first['semester_number']
    assert any(r['faculty'] and r['faculty'][0]['name'] for r in rows), 'faculty assigned to the section is listed'
