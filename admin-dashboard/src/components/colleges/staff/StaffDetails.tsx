"use client";

import { useEffect, useState } from "react";
import { Pencil, UserRound } from "lucide-react";
import {
  api,
  errorText,
  type Row,
  type StaffDetail,
  type StaffRow,
  type StaffKind,
} from "@/services/api";
import SideDrawer from "../SideDrawer";
import { RegisteredValues } from "../StudentEnrollmentDetails";
import { PersonFileList } from "../PersonFiles";
import RecordDetailTabs from "../RecordDetailTabs";

const labels = {
  teaching: "Teaching staff",
  non_teaching: "Non-teaching staff",
  labour: "Daily-wage employee",
};

function Section({ title, value }: { title: string; value: Row }) {
  return (
    <section className="edu-student-section">
      <h3>{title}</h3>
      <RegisteredValues value={value} />
    </section>
  );
}

export default function StaffDetails({
  staff,
  onClose,
  onEdit,
  kind,
}: {
  staff: StaffRow;
  kind: StaffKind;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const [data, setData] = useState<StaffDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "files">("details");
  useEffect(() => {
    let active = true;
    api.staff
      .detail(staff.employee_id)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [staff.employee_id]);
  const profile = data?.profile || {};
  const omitted = new Set([
    "code",
    "employee_code",
    "created_by_user_code",
    "document_checklist",
  ]);
  const financial = Object.fromEntries(
    Object.entries(profile).filter(([key]) =>
      /^(bank_|salary_|gross_|deductions_|net_|in_hand_|ctc_)/.test(key),
    ),
  );
  const registration = Object.fromEntries(
    Object.entries(profile).filter(
      ([key]) => !omitted.has(key) && !(key in financial),
    ),
  );
  return (
    <SideDrawer
      expanded
      title={staff.name}
      subtitle={`${staff.employee_id} · ${labels[kind]} details`}
      onClose={onClose}
      actions={
        onEdit && (
          <button type="button" onClick={onEdit} disabled={!data}>
            <Pencil size={15} aria-hidden="true" />
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
          <strong>{staff.designation}</strong>
          <p>
            {data?.department || staff.department || "Department not assigned"}
          </p>
        </div>
        <span className="edu-student-status">{staff.status}</span>
      </div>
      <RecordDetailTabs
        active={tab}
        onChange={setTab}
        label="Staff information"
      />
      {error && (
        <p role="alert" className="edu-error">
          {error}
        </p>
      )}
      {tab === "details" &&
        (!data ? (
          !error && <p role="status">Loading staff details…</p>
        ) : (
          <>
            <Section
              title="Personal, contact & employment details"
              value={{
                ...data.employee,
                department: data.department || staff.department,
              }}
            />
            {data.role && (
              <Section
                title={
                  kind === "teaching" ? "Teaching profile" : "Staff profile"
                }
                value={data.role}
              />
            )}
            <Section
              title={
                kind === "labour"
                  ? "Identity & registration"
                  : "Qualifications, identity & experience"
              }
              value={registration}
            />
            <Section
              title="Bank & salary details"
              value={{
                ...financial,
                salary_components: data.salary_components,
              }}
            />
          </>
        ))}
      <PersonFileList personKind="employee" personCode={staff.employee_id} />
    </SideDrawer>
  );
}
