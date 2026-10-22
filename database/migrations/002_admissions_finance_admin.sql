BEGIN;
-- BEGIN EDUNEXA V2: admission evidence, finance controls and management mobile support.

CREATE TABLE admission_sources (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 name TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('reference','social_media','walk_in','website','campaign','other')), is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_cycles (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code), academic_year_code VARCHAR(100) NOT NULL REFERENCES academic_years(code), name TEXT NOT NULL, opens_on DATE NOT NULL, closes_on DATE NOT NULL, CHECK(closes_on>=opens_on),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_enquiries (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code), source_code VARCHAR(100) NOT NULL REFERENCES admission_sources(code), cycle_code VARCHAR(100) REFERENCES admission_cycles(code), program_code VARCHAR(100) REFERENCES programs(code), first_name TEXT NOT NULL, last_name TEXT NOT NULL, phone VARCHAR(40) NOT NULL, email VARCHAR(254), parent_name TEXT, parent_phone VARCHAR(40), referrer_name TEXT, campaign_reference TEXT, assigned_employee_code VARCHAR(100) REFERENCES employees(code), status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','counselling','applied','closed','not_interested')), next_follow_up_at TIMESTAMPTZ, communication_consent BOOLEAN NOT NULL DEFAULT FALSE, consent_recorded_at TIMESTAMPTZ, CHECK(NOT communication_consent OR consent_recorded_at IS NOT NULL),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE enquiry_followups (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 enquiry_code VARCHAR(100) NOT NULL REFERENCES admission_enquiries(code), employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), occurred_at TIMESTAMPTZ NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('call','sms','email','visit','other')), outcome TEXT NOT NULL, notes TEXT, next_follow_up_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE admission_applications
 ADD COLUMN enquiry_code VARCHAR(100) REFERENCES admission_enquiries(code),
 ADD COLUMN cycle_code VARCHAR(100) REFERENCES admission_cycles(code),
 ADD COLUMN source_code VARCHAR(100) REFERENCES admission_sources(code),
 ADD COLUMN date_of_birth DATE, ADD COLUMN gender TEXT,
 ADD COLUMN admission_category TEXT NOT NULL DEFAULT 'regular' CHECK(admission_category IN ('regular','lateral_entry','transfer','readmission')),
 ADD COLUMN address JSONB NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN consent_at TIMESTAMPTZ, ADD COLUMN submitted_at TIMESTAMPTZ,
 ADD COLUMN assigned_employee_code VARCHAR(100) REFERENCES employees(code),
 ADD COLUMN submitted_by_user_code VARCHAR(100) REFERENCES users(code);
ALTER TABLE admission_applications DROP CONSTRAINT admission_applications_status_check;
ALTER TABLE admission_applications ADD CONSTRAINT admission_applications_status_check CHECK(status IN ('draft','submitted','documents_pending','reviewing','verified','offered','accepted','enrolled','rejected','withdrawn'));
CREATE UNIQUE INDEX uq_application_student ON admission_applications(student_code) WHERE student_code IS NOT NULL;
ALTER TABLE students ADD COLUMN middle_name TEXT, ADD COLUMN preferred_name TEXT,
 ADD COLUMN permanent_address JSONB, ADD COLUMN current_address_details JSONB,
 ADD COLUMN university_registration_number VARCHAR(100), ADD COLUMN admission_category TEXT,
 ADD COLUMN previous_education JSONB, ADD COLUMN profile_photo_storage_key TEXT,
 ADD COLUMN relieved_on DATE, ADD COLUMN relieving_reason TEXT,
 ADD COLUMN admission_application_code VARCHAR(100) UNIQUE REFERENCES admission_applications(code);
ALTER TABLE students DROP CONSTRAINT students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check CHECK(status IN ('active','graduated','withdrawn','suspended','relieved'));
ALTER TABLE parents ADD COLUMN work_contact JSONB, ADD COLUMN preferred_language TEXT, ADD COLUMN address_details JSONB;
ALTER TABLE employees ADD COLUMN personal_email VARCHAR(254), ADD COLUMN middle_name TEXT,
 ADD COLUMN contract_end_date DATE, ADD COLUMN confirmation_date DATE, ADD COLUMN exit_date DATE,
 ADD COLUMN reporting_employee_code VARCHAR(100) REFERENCES employees(code), ADD COLUMN address_details JSONB,
 ADD COLUMN qualifications JSONB, ADD COLUMN appointment_document_reference TEXT,
 ADD CONSTRAINT ck_employee_dates CHECK((contract_end_date IS NULL OR contract_end_date>=join_date) AND (exit_date IS NULL OR exit_date>=join_date)),
 ADD CONSTRAINT ck_no_self_reporting CHECK(reporting_employee_code IS NULL OR reporting_employee_code<>code);

CREATE TABLE application_guardians (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), relationship TEXT NOT NULL CHECK(relationship IN ('father','mother','guardian','other')), first_name TEXT NOT NULL, last_name TEXT NOT NULL, phone VARCHAR(40) NOT NULL, email VARCHAR(254), occupation TEXT, address JSONB, is_primary BOOLEAN NOT NULL DEFAULT FALSE, parent_code VARCHAR(100) REFERENCES parents(code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_application_primary_guardian ON application_guardians(application_code) WHERE is_primary;

CREATE TABLE application_qualifications (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), qualification TEXT NOT NULL, institution TEXT NOT NULL, board_university TEXT, passing_year INTEGER CHECK(passing_year BETWEEN 1900 AND 2200), registration_number VARCHAR(100), score NUMERIC(8,2) CHECK(score>=0), score_scale TEXT CHECK(score_scale IN ('percentage','cgpa_10','gpa_4','other')), maximum_score NUMERIC(8,2), result_status TEXT NOT NULL CHECK(result_status IN ('passed','awaiting','failed')), CHECK(maximum_score IS NULL OR score<=maximum_score),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_types (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 name TEXT NOT NULL, description TEXT, accepted_mime_types TEXT[] NOT NULL DEFAULT ARRAY['application/pdf','image/jpeg','image/png'], maximum_file_bytes BIGINT NOT NULL DEFAULT 10485760 CHECK(maximum_file_bytes>0), expiry_required BOOLEAN NOT NULL DEFAULT FALSE, original_sighting_required BOOLEAN NOT NULL DEFAULT FALSE, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE program_document_requirements (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 program_code VARCHAR(100) NOT NULL REFERENCES programs(code), academic_year_code VARCHAR(100) NOT NULL REFERENCES academic_years(code), document_type_code VARCHAR(100) NOT NULL REFERENCES document_types(code), admission_category TEXT NOT NULL DEFAULT 'all' CHECK(admission_category IN ('all','regular','lateral_entry','transfer','readmission')), required_stage TEXT NOT NULL CHECK(required_stage IN ('submission','offer','enrollment')), is_required BOOLEAN NOT NULL DEFAULT TRUE, waiver_allowed BOOLEAN NOT NULL DEFAULT FALSE, instructions TEXT, UNIQUE(program_code,academic_year_code,document_type_code,admission_category,required_stage),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_documents (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), document_type_code VARCHAR(100) NOT NULL REFERENCES document_types(code), revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0), is_current BOOLEAN NOT NULL DEFAULT TRUE, storage_key TEXT UNIQUE, original_filename TEXT, mime_type TEXT, size_bytes BIGINT CHECK(size_bytes>0), sha256 CHAR(64) CHECK(sha256 ~ '^[0-9a-f]{64}$'), issued_on DATE, expires_on DATE, uploaded_by_user_code VARCHAR(100) REFERENCES users(code), received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, received_by_employee_code VARCHAR(100) REFERENCES employees(code), status TEXT NOT NULL CHECK(status IN ('received','pending_verification','verified','rejected','waived')), original_sighted BOOLEAN NOT NULL DEFAULT FALSE, original_sighted_by_code VARCHAR(100) REFERENCES employees(code), original_sighted_at TIMESTAMPTZ, reviewed_by_employee_code VARCHAR(100) REFERENCES employees(code), reviewed_at TIMESTAMPTZ, review_notes TEXT, waiver_reason TEXT, CHECK(expires_on IS NULL OR issued_on IS NULL OR expires_on>=issued_on), CHECK(NOT original_sighted OR (original_sighted_by_code IS NOT NULL AND original_sighted_at IS NOT NULL)), CHECK(status NOT IN ('verified','rejected','waived') OR (reviewed_by_employee_code IS NOT NULL AND reviewed_at IS NOT NULL)), CHECK(status<>'waived' OR COALESCE(length(trim(waiver_reason)),0)>0), CHECK(status='waived' OR (storage_key IS NOT NULL AND original_filename IS NOT NULL AND mime_type IS NOT NULL AND size_bytes IS NOT NULL AND sha256 IS NOT NULL)), UNIQUE(application_code,document_type_code,revision),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_current_admission_document ON admission_documents(application_code,document_type_code) WHERE is_current;

CREATE TABLE document_verification_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 admission_document_code VARCHAR(100) NOT NULL REFERENCES admission_documents(code), actor_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), old_status TEXT, new_status TEXT NOT NULL, reason TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_reviews (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), reviewer_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), decision TEXT NOT NULL CHECK(decision IN ('pending','eligible','ineligible','hold')), eligibility_notes TEXT NOT NULL, reviewed_at TIMESTAMPTZ, CHECK(decision='pending' OR reviewed_at IS NOT NULL),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_status_history (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), old_status TEXT, new_status TEXT NOT NULL, actor_user_code VARCHAR(100) REFERENCES users(code), reason TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_offers (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL REFERENCES admission_applications(code), offer_number VARCHAR(100) NOT NULL UNIQUE, offered_program_code VARCHAR(100) NOT NULL REFERENCES programs(code), issued_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), issued_on DATE NOT NULL, accept_by DATE NOT NULL, status TEXT NOT NULL CHECK(status IN ('issued','accepted','declined','expired','withdrawn')), accepted_at TIMESTAMPTZ, terms TEXT, CHECK(accept_by>=issued_on), CHECK(status<>'accepted' OR accepted_at IS NOT NULL),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admission_enrollment_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 application_code VARCHAR(100) NOT NULL UNIQUE REFERENCES admission_applications(code), student_code VARCHAR(100) NOT NULL UNIQUE REFERENCES students(code), enrollment_code VARCHAR(100) NOT NULL UNIQUE REFERENCES student_enrollments(code), authorized_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_status_history (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 student_code VARCHAR(100) NOT NULL REFERENCES students(code), old_status TEXT, new_status TEXT NOT NULL, actor_user_code VARCHAR(100) REFERENCES users(code), reason TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_document_links (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 student_code VARCHAR(100) NOT NULL REFERENCES students(code), admission_document_code VARCHAR(100) NOT NULL REFERENCES admission_documents(code), transferred_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), UNIQUE(student_code,admission_document_code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE external_parties (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 name TEXT NOT NULL, party_type TEXT NOT NULL CHECK(party_type IN ('university','examination_board','government','other')), contact_email VARCHAR(254), ledger_reference TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE fee_heads ADD COLUMN collection_ownership TEXT NOT NULL DEFAULT 'internal' CHECK(collection_ownership IN ('internal','external')),
 ADD COLUMN external_party_code VARCHAR(100) REFERENCES external_parties(code), ADD COLUMN scholarship_eligible BOOLEAN NOT NULL DEFAULT TRUE,
 ADD CONSTRAINT ck_external_head_party CHECK(collection_ownership<>'external' OR external_party_code IS NOT NULL);
ALTER TABLE fee_structures DROP CONSTRAINT fee_structures_program_code_academic_year_code_fee_head_cod_key;
ALTER TABLE fee_structures ADD COLUMN installment_number INTEGER NOT NULL DEFAULT 1 CHECK(installment_number>0),
 ADD COLUMN billing_frequency TEXT NOT NULL DEFAULT 'semester' CHECK(billing_frequency IN ('one_time','annual','semester','term','monthly','per_use')),
 ADD COLUMN approval_reference TEXT,
 ADD CONSTRAINT uq_fee_structure_installment UNIQUE(program_code,academic_year_code,fee_head_code,semester_number,installment_number);
ALTER TABLE student_fee_charges ADD COLUMN tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(tax_amount>=0);
ALTER TABLE scholarships ADD COLUMN award_method TEXT NOT NULL DEFAULT 'fixed_amount' CHECK(award_method IN ('fixed_amount','percentage')),
 ADD COLUMN award_percent NUMERIC(5,2) CHECK(award_percent BETWEEN 0 AND 100), ADD COLUMN eligibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
 ADD CONSTRAINT ck_percent_scholarship CHECK((award_method='percentage' AND award_percent IS NOT NULL) OR (award_method='fixed_amount' AND award_percent IS NULL));

CREATE TABLE charge_scholarship_allocations (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 charge_code VARCHAR(100) NOT NULL REFERENCES student_fee_charges(code), student_scholarship_code VARCHAR(100) NOT NULL REFERENCES student_scholarships(code), amount NUMERIC(14,2) NOT NULL CHECK(amount>0), allocated_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), UNIQUE(charge_code,student_scholarship_code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refund_allocations (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 refund_code VARCHAR(100) NOT NULL REFERENCES refunds(code), charge_code VARCHAR(100) NOT NULL REFERENCES student_fee_charges(code), amount NUMERIC(14,2) NOT NULL CHECK(amount>0), UNIQUE(refund_code,charge_code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE external_remittances (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 party_code VARCHAR(100) NOT NULL REFERENCES external_parties(code), campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code), amount NUMERIC(14,2) NOT NULL CHECK(amount>0), currency VARCHAR(3) NOT NULL, paid_on DATE NOT NULL, transaction_reference TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','paid','failed')), expense_code VARCHAR(100) UNIQUE REFERENCES expenses(code), approved_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE remittance_allocations (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 remittance_code VARCHAR(100) NOT NULL REFERENCES external_remittances(code), charge_code VARCHAR(100) NOT NULL REFERENCES student_fee_charges(code), amount NUMERIC(14,2) NOT NULL CHECK(amount>0), UNIQUE(remittance_code,charge_code),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_gateway_orders (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 student_code VARCHAR(100) NOT NULL REFERENCES students(code), provider TEXT NOT NULL, provider_order_reference TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, amount NUMERIC(14,2) NOT NULL CHECK(amount>0), currency VARCHAR(3) NOT NULL, status TEXT NOT NULL CHECK(status IN ('created','pending','paid','failed','cancelled')), payment_code VARCHAR(100) UNIQUE REFERENCES payments(code), UNIQUE(provider,provider_order_reference),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_gateway_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 order_code VARCHAR(100) NOT NULL REFERENCES payment_gateway_orders(code), provider TEXT NOT NULL, provider_event_id TEXT NOT NULL, signature_verified BOOLEAN NOT NULL DEFAULT FALSE, received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, processed_at TIMESTAMPTZ, payload_sha256 CHAR(64) NOT NULL CHECK(payload_sha256 ~ '^[0-9a-f]{64}$'), status TEXT NOT NULL CHECK(status IN ('received','processed','rejected','failed')), UNIQUE(provider,provider_event_id), CHECK(status<>'processed' OR signature_verified),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fee_reminder_jobs (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 charge_code VARCHAR(100) NOT NULL REFERENCES student_fee_charges(code), parent_code VARCHAR(100) NOT NULL REFERENCES parents(code), cutoff_date DATE NOT NULL, scheduled_at TIMESTAMPTZ NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('sms','push','email')), message_template TEXT NOT NULL, consent_checked_at TIMESTAMPTZ, status TEXT NOT NULL CHECK(status IN ('queued','sent','failed','cancelled')), sent_at TIMESTAMPTZ, UNIQUE(charge_code,parent_code,channel,cutoff_date), CHECK(status<>'sent' OR (sent_at IS NOT NULL AND consent_checked_at IS NOT NULL)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_delivery_attempts (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 notification_code VARCHAR(100) REFERENCES notifications(code), reminder_code VARCHAR(100) REFERENCES fee_reminder_jobs(code), provider TEXT NOT NULL, provider_message_id TEXT, attempt_number INTEGER NOT NULL CHECK(attempt_number>0), status TEXT NOT NULL CHECK(status IN ('queued','sent','delivered','failed')), attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, error_code TEXT, CHECK(num_nonnulls(notification_code,reminder_code)=1),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE certificate_download_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 certificate_code VARCHAR(100) NOT NULL REFERENCES certificates(code), user_code VARCHAR(100) NOT NULL REFERENCES users(code), downloaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, channel TEXT NOT NULL CHECK(channel IN ('web','parent_app','student_app','admin_app')), document_sha256 CHAR(64) NOT NULL CHECK(document_sha256 ~ '^[0-9a-f]{64}$'), request_id TEXT NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE certificate_signatures (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 certificate_code VARCHAR(100) NOT NULL UNIQUE REFERENCES certificates(code), signing_provider TEXT NOT NULL, key_reference TEXT NOT NULL, signature_algorithm TEXT NOT NULL, signed_document_storage_key TEXT NOT NULL UNIQUE, document_sha256 CHAR(64) NOT NULL CHECK(document_sha256 ~ '^[0-9a-f]{64}$'), signed_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), signed_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_tax_documents (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), financial_year VARCHAR(9) NOT NULL, document_type TEXT NOT NULL CHECK(document_type IN ('form_16','form_16a','other')), revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0), storage_key TEXT NOT NULL UNIQUE, sha256 CHAR(64) NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'), published_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), published_at TIMESTAMPTZ NOT NULL, UNIQUE(employee_code,financial_year,document_type,revision),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_mobile_preferences (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 user_code VARCHAR(100) NOT NULL UNIQUE REFERENCES users(code), default_campus_code VARCHAR(100) REFERENCES campuses(code), default_period TEXT NOT NULL DEFAULT 'month' CHECK(default_period IN ('day','week','month','all')), alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE, report_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE report_export_jobs (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 requested_by_user_code VARCHAR(100) NOT NULL REFERENCES users(code), campus_code VARCHAR(100) NOT NULL REFERENCES campuses(code), report_type TEXT NOT NULL CHECK(report_type IN ('collections','outstanding','cashbook','external_remittances','expenses','payroll','admissions')), output_format TEXT NOT NULL CHECK(output_format IN ('pdf','csv','xlsx')), filters JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL CHECK(status IN ('queued','processing','ready','failed','expired')), storage_key TEXT, sha256 CHAR(64), expires_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, CHECK(status<>'ready' OR (storage_key IS NOT NULL AND completed_at IS NOT NULL AND expires_at IS NOT NULL AND sha256 IS NOT NULL)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE report_download_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 export_job_code VARCHAR(100) NOT NULL REFERENCES report_export_jobs(code), user_code VARCHAR(100) NOT NULL REFERENCES users(code), downloaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, request_id TEXT NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hostel_provision_issues (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code VARCHAR(100) NOT NULL UNIQUE,
 hostel_code VARCHAR(100) NOT NULL REFERENCES hostels(code), inventory_movement_code VARCHAR(100) NOT NULL UNIQUE REFERENCES inventory_movements(code), issued_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), received_by_employee_code VARCHAR(100) NOT NULL REFERENCES employees(code), issued_on DATE NOT NULL, notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE hostel_permissions ADD COLUMN pickup_person_name TEXT,
 ADD COLUMN pickup_relationship TEXT CHECK(pickup_relationship IN ('parent','sibling','guardian','authorized_relative','self')),
 ADD COLUMN pickup_contact VARCHAR(40), ADD COLUMN approved_at TIMESTAMPTZ,
 ADD COLUMN departed_at TIMESTAMPTZ, ADD COLUMN returned_at TIMESTAMPTZ,
 ADD CONSTRAINT ck_hostel_approved_actor CHECK(status NOT IN ('approved','returned') OR (approved_by_code IS NOT NULL AND approved_at IS NOT NULL)),
 ADD CONSTRAINT ck_hostel_pickup_details CHECK(pickup_relationship IS NULL OR pickup_relationship='self' OR pickup_person_name IS NOT NULL),
 ADD CONSTRAINT ck_hostel_return_time CHECK(returned_at IS NULL OR (departed_at IS NOT NULL AND returned_at>=departed_at));

CREATE FUNCTION validate_admission_transition() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE required_doc RECORD; doc admission_documents%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
 IF NEW.status IN ('offered','accepted','enrolled') THEN
   IF NEW.date_of_birth IS NULL OR NEW.consent_at IS NULL OR NEW.source_code IS NULL THEN RAISE EXCEPTION 'Admission identity, consent and source are required'; END IF;
   IF NOT EXISTS(SELECT 1 FROM application_guardians WHERE application_code=NEW.code AND is_primary) THEN RAISE EXCEPTION 'Primary application guardian is required'; END IF;
   IF NOT EXISTS(SELECT 1 FROM application_qualifications WHERE application_code=NEW.code AND result_status='passed') THEN RAISE EXCEPTION 'A passed qualifying education record is required'; END IF;
   IF NOT EXISTS(SELECT 1 FROM admission_reviews WHERE application_code=NEW.code AND decision='eligible') THEN RAISE EXCEPTION 'An eligible admission review is required'; END IF;
   IF NOT EXISTS(SELECT 1 FROM program_document_requirements WHERE program_code=NEW.program_code AND academic_year_code=NEW.academic_year_code) THEN RAISE EXCEPTION 'Program document checklist has not been configured'; END IF;
   FOR required_doc IN SELECT * FROM program_document_requirements WHERE program_code=NEW.program_code AND academic_year_code=NEW.academic_year_code AND is_required AND admission_category IN ('all',NEW.admission_category) AND (required_stage IN ('submission','offer') OR NEW.status='enrolled') LOOP
     SELECT * INTO doc FROM admission_documents WHERE application_code=NEW.code AND document_type_code=required_doc.document_type_code AND is_current;
     IF NOT FOUND OR doc.status NOT IN ('verified','waived') THEN RAISE EXCEPTION 'Required admission document % is not verified',required_doc.document_type_code; END IF;
     IF doc.status='waived' AND NOT required_doc.waiver_allowed THEN RAISE EXCEPTION 'Document waiver is not allowed'; END IF;
     IF doc.expires_on IS NOT NULL AND doc.expires_on<CURRENT_DATE THEN RAISE EXCEPTION 'Required admission document is expired'; END IF;
   END LOOP;
 END IF;
 IF NEW.status='enrolled' THEN
   IF TG_OP='INSERT' OR OLD.status<>'accepted' THEN RAISE EXCEPTION 'Enrollment requires an accepted application'; END IF;
   IF NEW.student_code IS NULL OR NOT EXISTS(SELECT 1 FROM admission_enrollment_events WHERE application_code=NEW.code AND student_code=NEW.student_code) THEN RAISE EXCEPTION 'Authorized enrollment linkage is required'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER admission_transition BEFORE INSERT OR UPDATE OF status ON admission_applications FOR EACH ROW EXECUTE FUNCTION validate_admission_transition();

CREATE FUNCTION validate_admission_document() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE kind document_types%ROWTYPE;
BEGIN
 SELECT * INTO kind FROM document_types WHERE code=NEW.document_type_code;
 IF NEW.status<>'waived' AND (NEW.size_bytes>kind.maximum_file_bytes OR NOT NEW.mime_type=ANY(kind.accepted_mime_types)) THEN RAISE EXCEPTION 'Document type or size is not permitted'; END IF;
 IF NEW.status='verified' AND ((kind.expiry_required AND NEW.expires_on IS NULL) OR (kind.original_sighting_required AND NOT NEW.original_sighted)) THEN RAISE EXCEPTION 'Document expiry or original sighting is required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER admission_document_validation BEFORE INSERT OR UPDATE ON admission_documents FOR EACH ROW EXECUTE FUNCTION validate_admission_document();

CREATE FUNCTION validate_enrollment_link() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM admission_applications a JOIN student_enrollments e ON e.code=NEW.enrollment_code JOIN sections sec ON sec.code=e.section_code JOIN batches b ON b.code=sec.batch_code JOIN semesters sem ON sem.code=sec.semester_code WHERE a.code=NEW.application_code AND a.status='accepted' AND e.student_code=NEW.student_code AND b.program_code=a.program_code AND sem.academic_year_code=a.academic_year_code) THEN RAISE EXCEPTION 'Enrollment student, program and academic year must match the accepted application'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER enrollment_link_validation BEFORE INSERT OR UPDATE ON admission_enrollment_events FOR EACH ROW EXECUTE FUNCTION validate_enrollment_link();

CREATE FUNCTION admission_history_record() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO admission_status_history(code,application_code,old_status,new_status,actor_user_code,reason) VALUES('AH-'||gen_random_uuid()::text,NEW.code,CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,NEW.status,NULLIF(current_setting('edunexa.actor_user_code',true),''),NULLIF(current_setting('edunexa.change_reason',true),''));
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER admission_history AFTER INSERT OR UPDATE ON admission_applications FOR EACH ROW EXECUTE FUNCTION admission_history_record();

CREATE FUNCTION prevent_history_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit history is append-only'; END; $$;
CREATE TRIGGER preserve_admission_history BEFORE UPDATE OR DELETE ON admission_status_history FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER preserve_verification_history BEFORE UPDATE OR DELETE ON document_verification_events FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER preserve_certificate_download_history BEFORE UPDATE OR DELETE ON certificate_download_events FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();

CREATE FUNCTION validate_payment_allocation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p payments%ROWTYPE; charge_student VARCHAR(100); charge_currency VARCHAR(100); allocated NUMERIC;
BEGIN
 SELECT * INTO p FROM payments WHERE code=NEW.payment_code FOR UPDATE;
 SELECT c.student_code,f.currency INTO charge_student,charge_currency FROM student_fee_charges c JOIN fee_structures f ON f.code=c.fee_structure_code WHERE c.code=NEW.charge_code;
 IF p.student_code<>charge_student OR p.currency<>charge_currency THEN RAISE EXCEPTION 'Payment and charge student/currency must match'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO allocated FROM payment_allocations WHERE payment_code=NEW.payment_code AND code<>NEW.code;
 IF NEW.amount<=0 OR allocated+NEW.amount>p.amount THEN RAISE EXCEPTION 'Allocation exceeds payment amount or is not positive'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_payment_split BEFORE INSERT OR UPDATE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION validate_payment_allocation();

CREATE VIEW student_charge_balances AS
WITH adj AS (SELECT charge_code,SUM(CASE WHEN adjustment_type='fine' THEN amount ELSE -amount END) delta FROM fee_adjustments GROUP BY charge_code),
sch AS (SELECT a.charge_code,SUM(a.amount) amount FROM charge_scholarship_allocations a JOIN student_scholarships s ON s.code=a.student_scholarship_code WHERE s.status IN ('approved','disbursed') GROUP BY a.charge_code),
paid AS (SELECT a.charge_code,SUM(a.amount) amount FROM payment_allocations a JOIN payments p ON p.code=a.payment_code WHERE p.status IN ('settled','refunded') GROUP BY a.charge_code),
ref AS (SELECT charge_code,SUM(amount) amount FROM refund_allocations GROUP BY charge_code)
SELECT c.code AS charge_code,c.student_code,f.currency,c.due_date,c.amount AS base_amount,COALESCE(adj.delta,0) AS adjustment_amount,c.tax_amount,COALESCE(sch.amount,0) AS scholarship_amount,
 c.amount+COALESCE(adj.delta,0)+c.tax_amount-COALESCE(sch.amount,0) AS net_payable,
 COALESCE(paid.amount,0)-COALESCE(ref.amount,0) AS paid_net,
 c.amount+COALESCE(adj.delta,0)+c.tax_amount-COALESCE(sch.amount,0)-COALESCE(paid.amount,0)+COALESCE(ref.amount,0) AS outstanding_amount
FROM student_fee_charges c JOIN fee_structures f ON f.code=c.fee_structure_code LEFT JOIN adj ON adj.charge_code=c.code LEFT JOIN sch ON sch.charge_code=c.code LEFT JOIN paid ON paid.charge_code=c.code LEFT JOIN ref ON ref.charge_code=c.code;
CREATE VIEW admin_outstanding_by_student AS SELECT student_code,currency,SUM(net_payable) net_payable,SUM(paid_net) paid_net,SUM(outstanding_amount) outstanding_amount,SUM(CASE WHEN due_date<CURRENT_DATE AND outstanding_amount>0 THEN outstanding_amount ELSE 0 END) overdue_amount FROM student_charge_balances GROUP BY student_code,currency;
CREATE VIEW certificate_download_summary AS SELECT certificate_code,COUNT(*) download_count,MAX(downloaded_at) last_downloaded_at FROM certificate_download_events GROUP BY certificate_code;

-- Keep expanded client collections intact until explicit source-to-target mappings are approved.
ALTER TABLE import_jobs ADD COLUMN contract_version TEXT NOT NULL DEFAULT '2.0', ADD COLUMN reviewed_by_user_code VARCHAR(100) REFERENCES users(code), ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE import_rows ADD COLUMN raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN mapped_data JSONB, ADD COLUMN source_headers JSONB;

CREATE FUNCTION enforce_admission_state_order() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE allowed TEXT[];
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'draft' THEN RAISE EXCEPTION 'New applications must start as drafts'; END IF;
   RETURN NEW;
 END IF;
 IF NEW.status=OLD.status THEN RETURN NEW; END IF;
 allowed:=CASE OLD.status
 WHEN 'draft' THEN ARRAY['submitted','withdrawn']
 WHEN 'submitted' THEN ARRAY['documents_pending','reviewing','rejected','withdrawn']
 WHEN 'documents_pending' THEN ARRAY['reviewing','rejected','withdrawn']
 WHEN 'reviewing' THEN ARRAY['documents_pending','verified','rejected','withdrawn']
 WHEN 'verified' THEN ARRAY['offered','rejected','withdrawn']
 WHEN 'offered' THEN ARRAY['accepted','rejected','withdrawn']
 WHEN 'accepted' THEN ARRAY['enrolled','withdrawn'] ELSE ARRAY[]::TEXT[] END;
 IF NOT NEW.status=ANY(allowed) THEN RAISE EXCEPTION 'Invalid admission status transition: % to %',OLD.status,NEW.status; END IF;
 IF NEW.status='offered' AND NOT EXISTS(SELECT 1 FROM admission_offers WHERE application_code=NEW.code AND status='issued') THEN RAISE EXCEPTION 'An issued admission offer is required'; END IF;
 IF NEW.status='accepted' AND NOT EXISTS(SELECT 1 FROM admission_offers WHERE application_code=NEW.code AND status='accepted' AND accept_by>=CURRENT_DATE) THEN RAISE EXCEPTION 'A valid accepted admission offer is required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER admission_state_order BEFORE INSERT OR UPDATE OF status ON admission_applications FOR EACH ROW EXECUTE FUNCTION enforce_admission_state_order();

CREATE FUNCTION capture_document_review_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN ('verified','rejected','waived') AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
  INSERT INTO document_verification_events(code,admission_document_code,actor_employee_code,old_status,new_status,reason)
  VALUES('DV-'||gen_random_uuid()::text,NEW.code,NEW.reviewed_by_employee_code,CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,NEW.status,COALESCE(NULLIF(NEW.review_notes,''),NULLIF(NEW.waiver_reason,''),'Document review recorded'));
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER document_review_event AFTER INSERT OR UPDATE ON admission_documents FOR EACH ROW EXECUTE FUNCTION capture_document_review_event();

CREATE FUNCTION capture_student_status_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO student_status_history(code,student_code,old_status,new_status,actor_user_code,reason)
  VALUES('SH-'||gen_random_uuid()::text,NEW.code,CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,NEW.status,NULLIF(current_setting('edunexa.actor_user_code',true),''),NULLIF(current_setting('edunexa.change_reason',true),''));
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER student_status_event AFTER INSERT OR UPDATE ON students FOR EACH ROW EXECUTE FUNCTION capture_student_status_event();
CREATE TRIGGER preserve_student_status_history BEFORE UPDATE OR DELETE ON student_status_history FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();

CREATE FUNCTION validate_student_document_link() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM admission_documents d JOIN admission_applications a ON a.code=d.application_code WHERE d.code=NEW.admission_document_code AND a.student_code=NEW.student_code AND a.status='enrolled') THEN RAISE EXCEPTION 'Document must belong to the enrolled student application'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER student_document_link_validation BEFORE INSERT OR UPDATE ON student_document_links FOR EACH ROW EXECUTE FUNCTION validate_student_document_link();

CREATE FUNCTION guard_payment_reduction() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.amount<(SELECT COALESCE(SUM(amount),0) FROM payment_allocations WHERE payment_code=OLD.code) THEN RAISE EXCEPTION 'Payment cannot be reduced below allocated total'; END IF;
 IF (NEW.student_code<>OLD.student_code OR NEW.currency<>OLD.currency) AND EXISTS(SELECT 1 FROM payment_allocations WHERE payment_code=OLD.code) THEN RAISE EXCEPTION 'Allocated payment student and currency cannot be changed'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER payment_reduction_guard BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION guard_payment_reduction();

CREATE FUNCTION validate_scholarship_allocation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE award student_scholarships%ROWTYPE; st VARCHAR(100); eligible BOOLEAN; total NUMERIC;
BEGIN
 SELECT * INTO award FROM student_scholarships WHERE code=NEW.student_scholarship_code FOR UPDATE;
 SELECT c.student_code,h.scholarship_eligible INTO st,eligible FROM student_fee_charges c JOIN fee_structures f ON f.code=c.fee_structure_code JOIN fee_heads h ON h.code=f.fee_head_code WHERE c.code=NEW.charge_code;
 IF award.student_code<>st OR award.status NOT IN ('approved','disbursed') OR NOT eligible THEN RAISE EXCEPTION 'Scholarship must be approved, belong to student and apply to eligible head'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO total FROM charge_scholarship_allocations WHERE student_scholarship_code=award.code AND code<>NEW.code;
 IF total+NEW.amount>award.amount THEN RAISE EXCEPTION 'Scholarship allocation exceeds approved award'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER scholarship_split_validation BEFORE INSERT OR UPDATE ON charge_scholarship_allocations FOR EACH ROW EXECUTE FUNCTION validate_scholarship_allocation();

CREATE FUNCTION guard_scholarship_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM charge_scholarship_allocations WHERE student_scholarship_code=OLD.code) AND (NEW.student_code<>OLD.student_code OR NEW.status NOT IN ('approved','disbursed') OR NEW.amount<(SELECT SUM(amount) FROM charge_scholarship_allocations WHERE student_scholarship_code=OLD.code)) THEN RAISE EXCEPTION 'Scholarship change conflicts with existing charge allocations'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER scholarship_change_guard BEFORE UPDATE ON student_scholarships FOR EACH ROW EXECUTE FUNCTION guard_scholarship_change();

CREATE FUNCTION protect_verified_document() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('verified','waived') AND (NEW.storage_key IS DISTINCT FROM OLD.storage_key OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.mime_type IS DISTINCT FROM OLD.mime_type OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes OR NEW.document_type_code<>OLD.document_type_code OR NEW.application_code<>OLD.application_code) THEN RAISE EXCEPTION 'Verified evidence cannot be replaced; upload a new document revision'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_document_evidence BEFORE UPDATE ON admission_documents FOR EACH ROW EXECUTE FUNCTION protect_verified_document();

CREATE FUNCTION validate_refund_split() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE r refunds%ROWTYPE; payment_student VARCHAR(100); charge_student VARCHAR(100); total NUMERIC; paid_amount NUMERIC;
BEGIN
 SELECT * INTO r FROM refunds WHERE code=NEW.refund_code FOR UPDATE;
 SELECT student_code INTO payment_student FROM payments WHERE code=r.payment_code;
 SELECT student_code INTO charge_student FROM student_fee_charges WHERE code=NEW.charge_code;
 IF payment_student<>charge_student THEN RAISE EXCEPTION 'Refund and charge students must match'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO total FROM refund_allocations WHERE refund_code=NEW.refund_code AND code<>NEW.code;
 IF total+NEW.amount>r.amount THEN RAISE EXCEPTION 'Refund allocation exceeds refund amount'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO paid_amount FROM payment_allocations WHERE payment_code=r.payment_code AND charge_code=NEW.charge_code;
 SELECT COALESCE(SUM(a.amount),0) INTO total FROM refund_allocations a JOIN refunds original ON original.code=a.refund_code WHERE original.payment_code=r.payment_code AND a.charge_code=NEW.charge_code AND a.code<>NEW.code;
 IF total+NEW.amount>paid_amount THEN RAISE EXCEPTION 'Charge refunds exceed original payment allocation'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER refund_split_validation BEFORE INSERT OR UPDATE ON refund_allocations FOR EACH ROW EXECUTE FUNCTION validate_refund_split();

CREATE FUNCTION validate_remittance_split() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE rem external_remittances%ROWTYPE; party VARCHAR(100); denomination VARCHAR(100); total NUMERIC;
BEGIN
 SELECT * INTO rem FROM external_remittances WHERE code=NEW.remittance_code FOR UPDATE;
 SELECT h.external_party_code,f.currency INTO party,denomination FROM student_fee_charges c JOIN fee_structures f ON f.code=c.fee_structure_code JOIN fee_heads h ON h.code=f.fee_head_code WHERE c.code=NEW.charge_code;
 IF party IS NULL OR party<>rem.party_code OR denomination<>rem.currency THEN RAISE EXCEPTION 'External party and currency must match the charge'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO total FROM remittance_allocations WHERE remittance_code=NEW.remittance_code AND code<>NEW.code;
 IF total+NEW.amount>rem.amount THEN RAISE EXCEPTION 'Remittance allocations exceed transfer amount'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER remittance_split_validation BEFORE INSERT OR UPDATE ON remittance_allocations FOR EACH ROW EXECUTE FUNCTION validate_remittance_split();

CREATE FUNCTION validate_hostel_period() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 -- Serialize changes to a bed, and to a student, before checking all date intervals.
 PERFORM 1 FROM students WHERE code=NEW.student_code FOR UPDATE;
 PERFORM 1 FROM hostel_beds WHERE code=NEW.bed_code FOR UPDATE;
 IF EXISTS(SELECT 1 FROM hostel_allocations a WHERE a.code<>NEW.code AND (a.bed_code=NEW.bed_code OR a.student_code=NEW.student_code) AND daterange(a.start_date,a.end_date,'[]') && daterange(NEW.start_date,NEW.end_date,'[]')) THEN RAISE EXCEPTION 'Hostel bed or student allocation overlaps an existing period'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER hostel_period_validation BEFORE INSERT OR UPDATE ON hostel_allocations FOR EACH ROW EXECUTE FUNCTION validate_hostel_period();

CREATE VIEW cashbook_movements AS
SELECT p.code reference,p.paid_on movement_date,s.campus_code,p.currency,'receipt'::TEXT movement_type,p.amount receipt_amount,0::NUMERIC payment_amount
FROM payments p JOIN students s ON s.code=p.student_code WHERE p.status IN ('settled','refunded')
UNION ALL SELECT e.code,e.expense_date,e.campus_code,e.currency,'expense',0,e.amount FROM expenses e WHERE e.approved_by_code IS NOT NULL
UNION ALL SELECT r.code,r.refunded_on,s.campus_code,p.currency,'refund',0,r.amount FROM refunds r JOIN payments p ON p.code=r.payment_code JOIN students s ON s.code=p.student_code
UNION ALL SELECT r.code,r.paid_on,r.campus_code,r.currency,'external_remittance',0,r.amount FROM external_remittances r WHERE r.status='paid' AND r.expense_code IS NULL;
-- Baseline expenses do not record cash settlement status. Add it explicitly; approved is not paid.
ALTER TABLE expenses ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','void')), ADD COLUMN paid_on DATE;
CREATE OR REPLACE VIEW cashbook_movements AS
SELECT p.code reference,p.paid_on movement_date,s.campus_code,p.currency,'receipt'::TEXT movement_type,p.amount receipt_amount,0::NUMERIC payment_amount
FROM payments p JOIN students s ON s.code=p.student_code WHERE p.status IN ('settled','refunded')
UNION ALL SELECT e.code,e.paid_on,e.campus_code,e.currency,'expense',0,e.amount FROM expenses e WHERE e.payment_status='paid'
UNION ALL SELECT r.code,r.refunded_on,s.campus_code,p.currency,'refund',0,r.amount FROM refunds r JOIN payments p ON p.code=r.payment_code JOIN students s ON s.code=p.student_code
UNION ALL SELECT r.code,r.paid_on,r.campus_code,r.currency,'external_remittance',0,r.amount FROM external_remittances r WHERE r.status='paid' AND r.expense_code IS NULL;
ALTER TABLE expenses ADD CONSTRAINT ck_expense_paid_date CHECK(payment_status<>'paid' OR paid_on IS NOT NULL);
CREATE VIEW daily_finance_summary AS SELECT movement_date,campus_code,currency,SUM(receipt_amount) receipts,SUM(payment_amount) payments,SUM(receipt_amount-payment_amount) net_movement FROM cashbook_movements GROUP BY movement_date,campus_code,currency;


CREATE TRIGGER touch_admission_sources BEFORE UPDATE ON admission_sources FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_cycles BEFORE UPDATE ON admission_cycles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_enquiries BEFORE UPDATE ON admission_enquiries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_enquiry_followups BEFORE UPDATE ON enquiry_followups FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_application_guardians BEFORE UPDATE ON application_guardians FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_application_qualifications BEFORE UPDATE ON application_qualifications FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_document_types BEFORE UPDATE ON document_types FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_program_document_requirements BEFORE UPDATE ON program_document_requirements FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_documents BEFORE UPDATE ON admission_documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_document_verification_events BEFORE UPDATE ON document_verification_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_reviews BEFORE UPDATE ON admission_reviews FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_status_history BEFORE UPDATE ON admission_status_history FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_offers BEFORE UPDATE ON admission_offers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admission_enrollment_events BEFORE UPDATE ON admission_enrollment_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_status_history BEFORE UPDATE ON student_status_history FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_student_document_links BEFORE UPDATE ON student_document_links FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_external_parties BEFORE UPDATE ON external_parties FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_charge_scholarship_allocations BEFORE UPDATE ON charge_scholarship_allocations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_refund_allocations BEFORE UPDATE ON refund_allocations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_external_remittances BEFORE UPDATE ON external_remittances FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_remittance_allocations BEFORE UPDATE ON remittance_allocations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_payment_gateway_orders BEFORE UPDATE ON payment_gateway_orders FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_payment_gateway_events BEFORE UPDATE ON payment_gateway_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_fee_reminder_jobs BEFORE UPDATE ON fee_reminder_jobs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_notification_delivery_attempts BEFORE UPDATE ON notification_delivery_attempts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_certificate_download_events BEFORE UPDATE ON certificate_download_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_certificate_signatures BEFORE UPDATE ON certificate_signatures FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_employee_tax_documents BEFORE UPDATE ON employee_tax_documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_admin_mobile_preferences BEFORE UPDATE ON admin_mobile_preferences FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_report_export_jobs BEFORE UPDATE ON report_export_jobs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_report_download_events BEFORE UPDATE ON report_download_events FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_hostel_provision_issues BEFORE UPDATE ON hostel_provision_issues FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX ix_admission_cycles_campus_code ON admission_cycles(campus_code);

CREATE INDEX ix_admission_cycles_academic_year_code ON admission_cycles(academic_year_code);

CREATE INDEX ix_admission_enquiries_campus_code ON admission_enquiries(campus_code);

CREATE INDEX ix_admission_enquiries_source_code ON admission_enquiries(source_code);

CREATE INDEX ix_admission_enquiries_cycle_code ON admission_enquiries(cycle_code);

CREATE INDEX ix_admission_enquiries_program_code ON admission_enquiries(program_code);

CREATE INDEX ix_admission_enquiries_assigned_employee_code ON admission_enquiries(assigned_employee_code);

CREATE INDEX ix_enquiry_followups_enquiry_code ON enquiry_followups(enquiry_code);

CREATE INDEX ix_enquiry_followups_employee_code ON enquiry_followups(employee_code);

CREATE INDEX ix_application_guardians_application_code ON application_guardians(application_code);

CREATE INDEX ix_application_guardians_parent_code ON application_guardians(parent_code);

CREATE INDEX ix_application_qualifications_application_code ON application_qualifications(application_code);

CREATE INDEX ix_program_document_requirements_program_code ON program_document_requirements(program_code);

CREATE INDEX ix_program_document_requirements_academic_year_code ON program_document_requirements(academic_year_code);

CREATE INDEX ix_program_document_requirements_document_type_code ON program_document_requirements(document_type_code);

CREATE INDEX ix_admission_documents_application_code ON admission_documents(application_code);

CREATE INDEX ix_admission_documents_document_type_code ON admission_documents(document_type_code);

CREATE INDEX ix_admission_documents_uploaded_by_user_code ON admission_documents(uploaded_by_user_code);

CREATE INDEX ix_admission_documents_received_by_employee_code ON admission_documents(received_by_employee_code);

CREATE INDEX ix_admission_documents_original_sighted_by_code ON admission_documents(original_sighted_by_code);

CREATE INDEX ix_admission_documents_reviewed_by_employee_code ON admission_documents(reviewed_by_employee_code);

CREATE INDEX ix_document_verification_events_admission_document_code ON document_verification_events(admission_document_code);

CREATE INDEX ix_document_verification_events_actor_employee_code ON document_verification_events(actor_employee_code);

CREATE INDEX ix_admission_reviews_application_code ON admission_reviews(application_code);

CREATE INDEX ix_admission_reviews_reviewer_employee_code ON admission_reviews(reviewer_employee_code);

CREATE INDEX ix_admission_status_history_application_code ON admission_status_history(application_code);

CREATE INDEX ix_admission_status_history_actor_user_code ON admission_status_history(actor_user_code);

CREATE INDEX ix_admission_offers_application_code ON admission_offers(application_code);

CREATE INDEX ix_admission_offers_offered_program_code ON admission_offers(offered_program_code);

CREATE INDEX ix_admission_offers_issued_by_employee_code ON admission_offers(issued_by_employee_code);

CREATE INDEX ix_admission_enrollment_events_application_code ON admission_enrollment_events(application_code);

CREATE INDEX ix_admission_enrollment_events_student_code ON admission_enrollment_events(student_code);

CREATE INDEX ix_admission_enrollment_events_enrollment_code ON admission_enrollment_events(enrollment_code);

CREATE INDEX ix_admission_enrollment_events_authorized_by_employee_code ON admission_enrollment_events(authorized_by_employee_code);

CREATE INDEX ix_student_status_history_student_code ON student_status_history(student_code);

CREATE INDEX ix_student_status_history_actor_user_code ON student_status_history(actor_user_code);

CREATE INDEX ix_student_document_links_student_code ON student_document_links(student_code);

CREATE INDEX ix_student_document_links_admission_document_code ON student_document_links(admission_document_code);

CREATE INDEX ix_student_document_links_transferred_by_employee_code ON student_document_links(transferred_by_employee_code);

CREATE INDEX ix_charge_scholarship_allocations_charge_code ON charge_scholarship_allocations(charge_code);

CREATE INDEX ix_charge_scholarship_allocations_student_scholarship_code ON charge_scholarship_allocations(student_scholarship_code);

CREATE INDEX ix_charge_scholarship_allocations_allocated_by_employee_code ON charge_scholarship_allocations(allocated_by_employee_code);

CREATE INDEX ix_refund_allocations_refund_code ON refund_allocations(refund_code);

CREATE INDEX ix_refund_allocations_charge_code ON refund_allocations(charge_code);

CREATE INDEX ix_external_remittances_party_code ON external_remittances(party_code);

CREATE INDEX ix_external_remittances_campus_code ON external_remittances(campus_code);

CREATE INDEX ix_external_remittances_expense_code ON external_remittances(expense_code);

CREATE INDEX ix_external_remittances_approved_by_employee_code ON external_remittances(approved_by_employee_code);

CREATE INDEX ix_remittance_allocations_remittance_code ON remittance_allocations(remittance_code);

CREATE INDEX ix_remittance_allocations_charge_code ON remittance_allocations(charge_code);

CREATE INDEX ix_payment_gateway_orders_student_code ON payment_gateway_orders(student_code);

CREATE INDEX ix_payment_gateway_orders_payment_code ON payment_gateway_orders(payment_code);

CREATE INDEX ix_payment_gateway_events_order_code ON payment_gateway_events(order_code);

CREATE INDEX ix_fee_reminder_jobs_charge_code ON fee_reminder_jobs(charge_code);

CREATE INDEX ix_fee_reminder_jobs_parent_code ON fee_reminder_jobs(parent_code);

CREATE INDEX ix_notification_delivery_attempts_notification_code ON notification_delivery_attempts(notification_code);

CREATE INDEX ix_notification_delivery_attempts_reminder_code ON notification_delivery_attempts(reminder_code);

CREATE INDEX ix_certificate_download_events_certificate_code ON certificate_download_events(certificate_code);

CREATE INDEX ix_certificate_download_events_user_code ON certificate_download_events(user_code);

CREATE INDEX ix_certificate_signatures_certificate_code ON certificate_signatures(certificate_code);

CREATE INDEX ix_certificate_signatures_signed_by_employee_code ON certificate_signatures(signed_by_employee_code);

CREATE INDEX ix_employee_tax_documents_employee_code ON employee_tax_documents(employee_code);

CREATE INDEX ix_employee_tax_documents_published_by_employee_code ON employee_tax_documents(published_by_employee_code);

CREATE INDEX ix_admin_mobile_preferences_user_code ON admin_mobile_preferences(user_code);

CREATE INDEX ix_admin_mobile_preferences_default_campus_code ON admin_mobile_preferences(default_campus_code);

CREATE INDEX ix_report_export_jobs_requested_by_user_code ON report_export_jobs(requested_by_user_code);

CREATE INDEX ix_report_export_jobs_campus_code ON report_export_jobs(campus_code);

CREATE INDEX ix_report_download_events_export_job_code ON report_download_events(export_job_code);

CREATE INDEX ix_report_download_events_user_code ON report_download_events(user_code);

CREATE INDEX ix_hostel_provision_issues_hostel_code ON hostel_provision_issues(hostel_code);

CREATE INDEX ix_hostel_provision_issues_inventory_movement_code ON hostel_provision_issues(inventory_movement_code);

CREATE INDEX ix_hostel_provision_issues_issued_by_employee_code ON hostel_provision_issues(issued_by_employee_code);

CREATE INDEX ix_hostel_provision_issues_received_by_employee_code ON hostel_provision_issues(received_by_employee_code);
COMMIT;
