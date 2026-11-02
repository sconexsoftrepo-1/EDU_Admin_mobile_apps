"""Pragathi certificate stationery shared by previews and signed PDF issuance."""
import io
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4,A5,letter,landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.pdfgen.canvas import Canvas

FORMATS={
    'study_certificate':('A4 portrait',A4,'#214756','#bb984c','#fffdf5'),
    'conduct_certificate':('A4 landscape',landscape(A4),'#243e69','#aebdd3','#f8faff'),
    'attendance_certificate':('A5 portrait',A5,'#116b69','#bd994e','#f5fbf8'),
    'course_completion':('US Letter landscape',landscape(letter),'#245844','#bba05c','#fafbf5'),
    'achievement':('A4 landscape',landscape(A4),'#712c40','#c8a354','#fffbf7'),
}


def render(title,student,kind,enrollment,data,code,issued,verify_url,issuer=None,academic_year_code=None,preview=False):
    def rows(table):return list(data['records'].get(table,{}).values())
    def get(table,key):return data['records'].get(table,{}).get(key,{})
    def name(p):return ' '.join(str(p.get(k) or '').strip() for k in ('first_name','middle_name','last_name')).strip()
    template=kind.get('code');_,page,ink,gold,paper=FORMATS.get(template,FORMATS['study_certificate'])
    w,h=page;portrait=h>w;compact=w<450
    out=io.BytesIO();c=Canvas(out,pagesize=page);c.setTitle(title);c.setAuthor('Pragathi College')
    primary,accent=HexColor(ink),HexColor(gold)
    section=get('sections',enrollment.get('section_code'));batch=get('batches',section.get('batch_code'))
    program=get('programs',enrollment.get('program_code') or batch.get('program_code'))
    year=get('academic_years',academic_year_code or batch.get('academic_year_code'))
    settings=next(iter(rows('institution_settings')),{});institution=get('institutions',settings.get('institution_code')) or next(iter(rows('institutions')),{})
    college=institution.get('name') or 'Pragathi College'
    course=program.get('name') or 'the registered course';academic=year.get('name') or 'the academic period recorded by the institution'
    admission=student.get('admission_number') or student['code'];roll=enrollment.get('university_roll_number') or enrollment.get('roll_number') or 'As recorded'
    address=', '.join(str(institution[k]) for k in ('address','city','state','postal_code') if institution.get(k))
    issuer_name=name(issuer or {});designation=(issuer or {}).get('designation') or 'Authorized signatory'
    margin=36 if compact else 58
    def text(value,y,size=11,font='Helvetica',color=None):
        c.setFillColor(color or primary);c.setFont(font,size)
        while c.stringWidth(str(value),font,size)>w-2*margin and size>6:
            size-=.5;c.setFont(font,size)
        c.drawCentredString(w/2,y,str(value))
    def para(value,y,size=12,leading=None):
        p=Paragraph(value,ParagraphStyle('certificate',fontName='Times-Roman',fontSize=size,leading=leading or size*1.55,textColor=primary,alignment=1))
        _,ph=p.wrap(w-2*margin,1000);p.drawOn(c,margin,y-ph);return y-ph
    c.setFillColor(HexColor(paper));c.rect(0,0,w,h,fill=1,stroke=0)
    c.setStrokeColor(primary);c.setLineWidth(1.6);c.rect(19,19,w-38,h-38)
    c.setStrokeColor(accent);c.setLineWidth(.7);c.rect(26,26,w-52,h-52)
    # Distinct stationery, with the same institutional identity and seal.
    if template=='achievement':
        for right in (False,True):
            c.setFillColor(primary);p=c.beginPath();x=w if right else 0;y=0 if right else h
            p.moveTo(x,y);p.lineTo(x+(-135 if right else 135),y);p.lineTo(x,y+(135 if right else -135));p.close();c.drawPath(p,fill=1,stroke=0)
    elif template=='attendance_certificate':
        c.setFillColor(primary);c.rect(0,0,12,h,fill=1,stroke=0)
        c.setFillColor(accent);c.rect(w-12,0,12,h,fill=1,stroke=0)
    elif template=='conduct_certificate':
        c.setFillColor(primary);c.rect(27,27,10,h-54,fill=1,stroke=0)
        c.setStrokeColor(accent)
        for x in range(55,int(w-40),10):c.line(x,h-142,x+3,h-142)
    elif template=='course_completion':
        c.setFillColor(primary);c.roundRect(37,h-44,w-74,7,3,fill=1,stroke=0)
    else:
        for x in (35,w-35):
            for y in (35,h-35):
                c.setStrokeColor(accent);c.circle(x,y,5)
    logo=Path(__file__).resolve().parents[2]/'assets/pragathi-logo.jpg'
    logo_size=49 if compact else 62;top=h-45
    if logo.exists():c.drawImage(ImageReader(str(logo)),(w-logo_size)/2,top-logo_size,width=logo_size,height=logo_size,preserveAspectRatio=True,anchor='c',mask='auto')
    y=top-logo_size-22;text(college,y,16 if compact else 23,'Times-Bold')
    if address:y-=16;text(address,y,7 if compact else 8)
    y-=20;text('ACADEMIC RECORDS • OFFICE OF THE PRINCIPAL',y,6.5 if compact else 8,'Helvetica-Bold',accent)
    y-=36 if portrait else 35
    headings={'study_certificate':'STUDY CERTIFICATE','conduct_certificate':'CERTIFICATE OF CONDUCT','attendance_certificate':'CERTIFICATE OF ATTENDANCE','course_completion':'CERTIFICATE OF COMPLETION','achievement':'CERTIFICATE OF ACHIEVEMENT'}
    text(headings.get(template,title.upper()),y,17 if compact else 25,'Times-Bold')
    c.setStrokeColor(accent);c.line(w*.35,y-12,w*.65,y-12)
    y-=36;text('This is to certify that',y,9 if compact else 11)
    y-=32;text(name(student),y,22 if compact else 29,'Times-Italic')
    y-=15
    statements={
        'study_certificate':f'is enrolled in <b>{escape(course)}</b> at {escape(college)} during <b>{escape(academic)}</b>. The particulars below are certified from the institution’s academic records.',
        'conduct_certificate':f'has maintained good conduct during the recorded period of study in <b>{escape(course)}</b>, {escape(academic)}. This certificate is issued on the authority of the institution’s records.',
        'attendance_certificate':f'has attended the academic programme <b>{escape(course)}</b> during <b>{escape(academic)}</b>. This certificate confirms the attendance recorded by the institution for that academic period.',
        'course_completion':f'has successfully completed the prescribed course of study in <b>{escape(course)}</b> during <b>{escape(academic)}</b>, subject to the verified academic records maintained by {escape(college)}.',
        'achievement':f'is recognized for academic achievement in <b>{escape(course)}</b> during <b>{escape(academic)}</b>. Presented with appreciation for dedication to learning and academic progress.',
    }
    y=para(statements.get(template,statements['study_certificate']),y,10 if compact else 12)
    y-=23;text(f'Admission: {admission}  •  Roll: {roll}',y,7 if compact else 9)
    if template=='study_certificate':
        y-=21;text('Date of birth: '+str(student.get('date_of_birth') or 'As recorded'),y,9)
    # Fixed reserved footer region prevents body text and signatures colliding.
    sy=104 if compact else 116
    c.setStrokeColor(accent);c.setLineWidth(1.3);c.circle(w/2,sy,27)
    c.setLineWidth(.5);c.circle(w/2,sy,23)
    text('PRAGATHI',sy+6,6.5,'Helvetica-Bold');text('COLLEGE',sy-3,6.5,'Helvetica-Bold');text('OFFICIAL SEAL',sy-13,5,'Helvetica',accent)
    for x,caption in ((w*.23,'RECORDS OFFICE'),(w*.77,designation.upper())):
        span=49 if compact else 75
        c.setStrokeColor(primary);c.line(x-span,sy-5,x+span,sy-5)
        c.setFont('Helvetica-Bold',5.5 if compact else 7);c.setFillColor(primary);c.drawCentredString(x,sy-18,caption[:35])
        if x>w/2:
            c.setFont('Times-Italic',8 if compact else 12);c.drawCentredString(x,sy+7,(issuer_name or 'Digitally authenticated')[:35])
            c.setFont('Helvetica',5.5);c.drawCentredString(x,sy-29,'E-signature • verified certificate record')
    text(f'Certificate {code}  •  Issued {issued}',65 if compact else 68,6.5 if compact else 8)
    from reportlab.graphics.barcode import qr
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics import renderPDF
    if preview:
        text('PREVIEW - NOT ISSUED',46,9,'Helvetica-Bold',accent)
        c.save();return out.getvalue()
    mark=qr.QrCodeWidget(verify_url);bounds=mark.getBounds();size=28
    drawing=Drawing(size,size,transform=[size/(bounds[2]-bounds[0]),0,0,size/(bounds[3]-bounds[1]),0,0]);drawing.add(mark);renderPDF.draw(drawing,c,margin,32)
    text('Verify authenticity using the QR code or secure verification link',46,5.8 if compact else 7)
    c.linkURL(verify_url,(margin+35,32,w-margin,57),relative=0)
    c.save();return out.getvalue()
