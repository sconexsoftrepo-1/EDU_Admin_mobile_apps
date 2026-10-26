CREATE TABLE IF NOT EXISTS file_storage_objects (
    code VARCHAR(80) PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL,
    owner_code VARCHAR(100) NOT NULL,
    document_table VARCHAR(80) NOT NULL,
    document_code VARCHAR(100) NOT NULL,
    storage_key VARCHAR(1024) NOT NULL,
    storage_provider VARCHAR(30) NOT NULL,
    s3_bucket VARCHAR(255),
    s3_key VARCHAR(1024),
    s3_uri VARCHAR(1400),
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    document_url VARCHAR(1024) NOT NULL,
    uploaded_at VARCHAR(40) NOT NULL,
    uploaded_by_user_code VARCHAR(100) NOT NULL,
    deleted_at VARCHAR(40)
);
CREATE INDEX IF NOT EXISTS ix_file_storage_owner ON file_storage_objects(owner_type, owner_code);

ALTER TABLE file_storage_objects ALTER COLUMN owner_code TYPE VARCHAR(100);
ALTER TABLE file_storage_objects ALTER COLUMN document_code TYPE VARCHAR(100);
ALTER TABLE file_storage_objects ALTER COLUMN uploaded_by_user_code TYPE VARCHAR(100);
