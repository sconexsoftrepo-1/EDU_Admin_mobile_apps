import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from seed_linked_academics import populate,write_logins
from app.core.curriculum_workspace import insert,starter
from app.core.security import hasher


def test_seed_is_linked_idempotent_and_preserves_existing_accounts(app,tmp_path):
    with app.state.store.transaction() as d:
        def put(t,c,**v):d['records'].setdefault(t,{})[c]={'code':c,**v}
        put('institutions','I',name='Pragathi College')
        put('campuses','C',institution_code='I',name='Main')
        put('departments','D',campus_code='C',name='Academics')
        for i,(name,duration) in enumerate([('Intermediate BPC',4),('Intermediate MPC',4),('BCA',6),('B.Com General',6)]):
            p={'code':f'P{i}','name':name,'department_code':'D','duration_semesters':duration,'course_level':'intermediate' if i<2 else 'degree'}
            d['records'].setdefault('programs',{})[p['code']]=p
            insert(d,p,starter(p),True)
        original=dict(d['accounts']['ADMIN'])
        result,created=populate(d,'test@123')
        assert created and result['counts']['students']==48
        assert d['accounts']['ADMIN']==original
        assert all(hasher.verify(a['password_hash'],'test@123') for c,a in d['accounts'].items() if c.startswith('D26-'))
        assert all(len([o for o in d['records']['subject_offerings'].values() if o['section_code']==b['section_code']])>0 for b in result['batches'])
        assert all(d['records']['students'].get(r['student_code']) and d['records']['parents'].get(r['parent_code']) for r in d['records']['student_parents'].values())
        assert [b['current_semester'] for b in result['batches']]==[1,3,5,3]
        again,created=populate(d,'test@123');assert not created and again==result
    target=tmp_path/'logins.txt';write_logins(result,'test@123',target)
    assert 'test@123' in target.read_text() and 'demo.student48' in target.read_text()
    assert target.stat().st_mode&0o777==0o600
    from app.core.security import current_user
    from fastapi.testclient import TestClient
    users=[('D26-ADMIN','admin-mobile',48),('D26-TA01','teacher-mobile',12),('D26-SA13','student-mobile',1),('D26-PA25','parent-mobile',1)]
    for account,client_id,count in users:
        user={**app.state.store.snapshot()['accounts'][account],'client':client_id,'workspace_scope':'teaching' if client_id=='teacher-mobile' else 'self' if client_id in {'student-mobile','parent-mobile'} else 'college'}
        app.dependency_overrides[current_user]=lambda user=user:user
        with TestClient(app) as c:
            response=c.get('/api/v1/academics/semester-workspace')
            assert response.status_code==200,response.text
            body=response.json();assert body['totals']['students']==count
            assert body['batches'] and body['today_classes']
            assert body['fees'] or client_id=='teacher-mobile'
            for path in ('assignment-workspace','assessment-workspace'):
                response=c.get('/api/v1/academics/'+path)
                assert response.status_code==200,response.text
                assert response.json()['items']
    app.dependency_overrides.clear()
