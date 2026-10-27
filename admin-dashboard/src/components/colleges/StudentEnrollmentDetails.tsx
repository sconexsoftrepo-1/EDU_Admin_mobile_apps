"use client";

import { useEffect, useState } from "react";
import { Pencil, UserRound } from "lucide-react";
import { api, errorText, type Row } from "@/services/api";
import { headerLabel } from "@/lib/colleges/export-table";
import { formatDate } from "./DateInput";
import SideDrawer from "./SideDrawer";
import { PersonFileList } from "./PersonFiles";
import RecordDetailTabs from "./RecordDetailTabs";

const hidden = new Set([
  "code",
  "storage_key",
  "profile_photo_storage_key",
  "profile_photo_url",
  "created_by_user_code",
  "sha256",
  "document_code",
  "verification_token",
  "s3_key",
  "s3_uri",
  "s3_bucket",
  "storage_provider",
  "student_code",
  "parent_code",
  "employee_code",
  "program_code",
  "batch_code",
  "academic_year_code",
  "section_code",
  "student_name",
  "course_name",
  "batch_year",
]);
function valueText(value: unknown, key: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (
    typeof value === "string" &&
    /date|_on$/.test(key) &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  )
    return formatDate(value.slice(0, 10));
  return String(value).replaceAll("_", " ");
}
export function RegisteredValues({ value }: { value: Row }) {
  return (
    <dl className="edu-student-values">
      {Object.entries(value)
        .filter(([key]) => !hidden.has(key))
        .map(([key, item]) => (
          <div
            key={key}
            className={
              item && typeof item === "object" ? "edu-value-wide" : undefined
            }
          >
            <dt>{headerLabel(key)}</dt>
            <dd>
              {item && typeof item === "object" ? (
                Array.isArray(item) ? (
                  item.length ? (
                    item.map((entry, index) => (
                      <div key={index} className="edu-value-entry">
                        {entry && typeof entry === "object" ? (
                          <RegisteredValues value={entry as Row} />
                        ) : (
                          valueText(entry, key)
                        )}
                      </div>
                    ))
                  ) : (
                    "—"
                  )
                ) : (
                  <RegisteredValues value={item as Row} />
                )
              ) : (
                valueText(item, key)
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
function Section({ title, value }: { title: string; value: Row }) {
  return Object.keys(value).length ? (
    <section className="edu-student-section">
      <h3>{title}</h3>
      <RegisteredValues value={value} />
    </section>
  ) : null;
}
const pick = (row: Row, keys: string[]) =>
  Object.fromEntries(
    keys.filter((key) => key in row).map((key) => [key, row[key]]),
  );

export default function StudentEnrollmentDetails({
  student,
  onClose,
  onEdit,
}: {
  student: Row;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "files">("details");
  useEffect(() => {
    let active = true;
    api.masterData
      .enrollmentReview(String(student.code))
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [student.code]);
  const person = (data?.student || student) as Row;
  const profile = (data?.profile || {}) as Row;
  const program = (data?.program || {}) as Row;
  const batch = (data?.batch || {}) as Row;
  const name = [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ");
  const identity = [
    "first_name",
    "middle_name",
    "last_name",
    "date_of_birth",
    "gender",
    "aadhaar_number",
    "blood_group",
    "nationality",
  ];
  const contact = [
    "email",
    "phone",
    "address",
    "city",
    "state",
    "postal_code",
    "country",
    "permanent_address",
    "current_address_details",
    "emergency_contact_name",
    "emergency_contact_phone",
  ];
  const remaining = Object.fromEntries(
    Object.entries(person).filter(
      ([key]) =>
        ![...identity, ...contact, "previous_education"].includes(key) &&
        !hidden.has(key),
    ),
  );
  return (
    <SideDrawer
      expanded
      title={name || "Student details"}
      subtitle={String(person.admission_number || "Enrollment record")}
      onClose={onClose}
      actions={
        onEdit && (
          <button type="button" onClick={onEdit}>
            <Pencil size={15} />
            Edit
          </button>
        )
      }
    >
      <div className="edu-student-summary">
        <span className="edu-student-avatar" aria-hidden="true">
          <UserRound size={26} />
        </span>
        <div>
          <strong>
            {String(
              program.name || student.course_name || "Course not assigned",
            )}
          </strong>
          <p>
            {String(batch.name || student.batch_year || "Batch not assigned")}
          </p>
        </div>
        <span className="edu-student-status">
          {valueText(person.status, "status")}
        </span>
      </div>
      <RecordDetailTabs
        active={tab}
        onChange={setTab}
        label="Student information"
      />
      {error && (
        <p className="edu-error" role="alert">
          {error}
        </p>
      )}
      {tab === "details" ? (
        <>
          {!data && !error && <p role="status">Loading enrollment details…</p>}
          <Section title="Student identity" value={pick(person, identity)} />
          <Section title="Contact & address" value={pick(person, contact)} />
          <Section title="Admission & registration" value={remaining} />
          {person.previous_education &&
          typeof person.previous_education === "object" ? (
            <Section
              title="Previous education"
              value={person.previous_education as Row}
            />
          ) : null}
          <Section
            title="Course & batch"
            value={{
              course: program.name || student.course_name,
              branch: program.branch,
              batch: batch.name || student.batch_year,
              entry_year: batch.entry_year,
              graduation_year: batch.graduation_year,
              current_year: person.current_year,
            }}
          />
          {Array.isArray(data?.parents) &&
            data.parents.map((parent, index) => (
              <Section
                key={index}
                title={`Guardian ${index + 1}`}
                value={parent as Row}
              />
            ))}
          <Section title="Enrollment details & fee summary" value={profile} />
          <PersonFileList
            personKind="student"
            personCode={String(person.code)}
          />
        </>
      ) : (
        <PersonFileList personKind="student" personCode={String(person.code)} />
      )}
    </SideDrawer>
  );
}
