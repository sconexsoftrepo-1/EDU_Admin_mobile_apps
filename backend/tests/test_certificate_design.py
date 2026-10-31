import subprocess
import shutil
import pytest
from app.core.certificate_design import FORMATS,render

@pytest.mark.parametrize('template',FORMATS)
def test_branded_certificate_has_correct_page_logo_and_verification(template,tmp_path):
    data={'records':{'institutions':{'I':{'code':'I','name':'Pragathi College','city':'Hyderabad'}},'programs':{'P':{'name':'Intermediate BPC'}},'academic_years':{'Y':{'name':'2026–2028'}}}}
    raw=render('Certificate',{'code':'ST','first_name':'Ananya','last_name':'Reddy','admission_number':'D26-001'},{'code':template},{'program_code':'P'},data,'CERT-DEMO','2026-10-31','https://college.example/verify/demo',{'first_name':'Sahana','last_name':'Rao','designation':'Principal'},'Y')
    target=tmp_path/(template+'.pdf');target.write_bytes(raw)
    if not shutil.which('pdftotext'):pytest.skip('Poppler is needed for PDF layout inspection')
    text=subprocess.check_output(['pdftotext',str(target),'-'],text=True)
    info=subprocess.check_output(['pdfinfo',str(target)],text=True)
    assert 'Pages:           1' in info
    assert 'Pragathi College' in text and 'Ananya Reddy' in text and 'Sahana Rao' in text
    assert b'/Subtype /Image' in raw and b'https://college.example/verify/demo' in raw
    from pathlib import Path
    Path('/private/tmp/edunexa-cert-'+template+'.pdf').write_bytes(raw)
