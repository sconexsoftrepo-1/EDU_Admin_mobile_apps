"use client";
/**
 * Staff onboarding form (side screen) for teaching staff, non-teaching staff and daily labour.
 * Every employee gets the next employee ID (EMP-PRA-005 ...). Teaching and non-teaching staff:
 * personal and contact details, job, qualification, qualification certificates (type a name and
 * press Enter to add its upload), Aadhaar and PAN with copies, previous experience, employment
 * history, achievements, bank account and a monthly salary breakdown. Daily labour: name, role,
 * Aadhaar, bank account and wage. Files are uploaded after the employee is saved.
 */
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  Award,
  Banknote,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  IdCard,
  Plus,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import {
  QUALIFICATION_LEVELS,
  STAFF_KIND_LABEL,
  api,
  errorText,
  type QualificationLevel,
  type StaffKind,
  type StaffOnboardingPayload,
  type StaffOnboardingResult,
  type StaffOptions,
} from "@/services/api";
import {
  Card,
  Field,
  FilePick,
  PhoneInput,
  toBase64,
} from "../enrollment/StudentEnrollmentWizard";
import "../enrollment/enrollment-wizard.css";
import "./staff.css";

type Experience = {
  organization: string;
  role: string;
  from_date: string;
  to_date: string;
  details: string;
  file?: File;
};
type History = {
  organization: string;
  designation: string;
  from_date: string;
  to_date: string;
  reason_for_leaving: string;
};
type Achievement = { title: string; year: string; details: string };
type Component = {
  component: string;
  component_type: "earning" | "deduction";
  amount: string;
};

const DEFAULT_COMPONENTS: Component[] = [
  { component: "Basic pay", component_type: "earning", amount: "" },
  {
    component: "House rent allowance (HRA)",
    component_type: "earning",
    amount: "",
  },
  {
    component: "Dearness allowance (DA)",
    component_type: "earning",
    amount: "",
  },
  { component: "Special allowance", component_type: "earning", amount: "" },
  { component: "Provident fund (PF)", component_type: "deduction", amount: "" },
  { component: "Professional tax", component_type: "deduction", amount: "" },
  { component: "Income tax (TDS)", component_type: "deduction", amount: "" },
];
const num = (v: string | number | undefined) => Number(v || 0) || 0;
const inr = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(v);
/** Same key the backend uses for a certificate's checklist entry. */
const certificateKey = (name: string) =>
  "certificate_" +
  (name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50) || "certificate");

export default function StaffOnboardingForm({
  kind,
  onClose,
  onSaved,
}: {
  kind: StaffKind;
  onClose: () => void;
  onSaved?: (employeeId: string) => void;
}) {
  const labour = kind === "labour";
  const [options, setOptions] = useState<StaffOptions | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StaffOnboardingResult | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [person, setPerson] = useState({
    first_name: "",
    last_name: "",
    gender: "",
    date_of_birth: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "Telangana",
    postal_code: "",
  });
  const [phoneCode, setPhoneCode] = useState("+91");
  const [job, setJob] = useState({
    designation: "",
    department: "",
    join_date: new Date().toISOString().slice(0, 10),
    employment_type: labour ? "daily_wage" : "permanent",
  });
  const [qualification, setQualification] = useState<{
    level: QualificationLevel | "";
    specialization: string;
  }>({ level: "", specialization: "" });
  const [certificateName, setCertificateName] = useState("");
  const [certificates, setCertificates] = useState<
    { name: string; file?: File }[]
  >([]);
  const [aadhaar, setAadhaar] = useState({
    number: "",
    file: undefined as File | undefined,
  });
  const [pan, setPan] = useState({
    number: "",
    file: undefined as File | undefined,
  });
  const [experience, setExperience] = useState<Experience[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [bank, setBank] = useState({
    account_holder: "",
    account_number: "",
    bank_name: "",
    ifsc: "",
    branch: "",
    file: undefined as File | undefined,
  });
  const [components, setComponents] = useState<Component[]>(DEFAULT_COMPONENTS);
  const [ctc, setCtc] = useState("");
  const [inHand, setInHand] = useState("");
  const [wage, setWage] = useState({
    basis: "daily" as "daily" | "monthly" | "yearly",
    amount: "",
  });

  useEffect(() => {
    void api.staff
      .options()
      .then(setOptions)
      .catch((e) => setError(errorText(e)));
  }, []);

  const totals = useMemo(() => {
    const earnings = components
      .filter((c) => c.component_type === "earning")
      .reduce((n, c) => n + num(c.amount), 0);
    const deductions = components
      .filter((c) => c.component_type === "deduction")
      .reduce((n, c) => n + num(c.amount), 0);
    return { earnings, deductions, net: earnings - deductions };
  }, [components]);
  const wageMonthly =
    wage.basis === "daily"
      ? num(wage.amount) * 26
      : wage.basis === "yearly"
        ? num(wage.amount) / 12
        : num(wage.amount);

  function addCertificate(e?: KeyboardEvent<HTMLInputElement>) {
    if (e && e.key !== "Enter") return;
    e?.preventDefault();
    const name = certificateName.trim();
    if (!name) return;
    if (certificates.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return setError(`"${name}" is already in the list.`);
    setCertificates([...certificates, { name }]);
    setCertificateName("");
    setError("");
  }

  function payload(): StaffOnboardingPayload {
    const phone = person.phone.trim()
      ? `${phoneCode} ${person.phone.trim()}`
      : undefined;
    return {
      kind,
      personal: {
        first_name: person.first_name.trim(),
        last_name: person.last_name.trim(),
        gender: person.gender || undefined,
        date_of_birth: person.date_of_birth || undefined,
        email: person.email.trim() || undefined,
        phone,
        address: person.address.trim() || undefined,
        city: person.city.trim() || undefined,
        state: person.state.trim() || undefined,
        postal_code: person.postal_code.trim() || undefined,
      },
      job: {
        designation: job.designation.trim(),
        department: job.department.trim() || undefined,
        join_date: job.join_date,
        employment_type:
          job.employment_type as StaffOnboardingPayload["job"]["employment_type"],
      },
      qualification:
        !labour && qualification.level
          ? {
              level: qualification.level,
              specialization: qualification.specialization.trim() || undefined,
            }
          : null,
      certificates: labour ? [] : certificates.map((c) => c.name),
      aadhaar_number: aadhaar.number.replace(/\s/g, ""),
      pan_number:
        !labour && pan.number.trim() ? pan.number.trim().toUpperCase() : null,
      previous_experience: labour
        ? []
        : experience
            .filter((x) => x.organization.trim())
            .map((x) => ({
              organization: x.organization.trim(),
              role: x.role || undefined,
              from_date: x.from_date || undefined,
              to_date: x.to_date || undefined,
              details: x.details || undefined,
            })),
      employment_history: labour
        ? []
        : history
            .filter((x) => x.organization.trim())
            .map((x) => ({
              organization: x.organization.trim(),
              designation: x.designation || undefined,
              from_date: x.from_date || undefined,
              to_date: x.to_date || undefined,
              reason_for_leaving: x.reason_for_leaving || undefined,
            })),
      achievements: labour
        ? []
        : achievements
            .filter((a) => a.title.trim())
            .map((a) => ({
              title: a.title.trim(),
              year: num(a.year) || undefined,
              details: a.details || undefined,
            })),
      bank: {
        account_holder: bank.account_holder.trim(),
        account_number: bank.account_number.replace(/\s/g, ""),
        bank_name: bank.bank_name.trim(),
        ifsc: bank.ifsc.trim().toUpperCase(),
        branch: bank.branch.trim() || undefined,
      },
      salary: labour
        ? {
            basis: wage.basis,
            amount: num(wage.amount).toFixed(2),
            components: [],
          }
        : {
            components: components
              .filter((c) => c.component.trim() && num(c.amount) > 0)
              .map((c) => ({ ...c, amount: num(c.amount).toFixed(2) })),
            ctc_annual: ctc ? num(ctc).toFixed(2) : undefined,
            in_hand_monthly: inHand ? num(inHand).toFixed(2) : undefined,
          },
    };
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    if (!aadhaar.file) return setError("Upload the Aadhaar copy.");
    if (!labour && totals.earnings <= 0)
      return setError("Add the salary breakdown: at least one earning.");
    if (!labour && totals.deductions > totals.earnings)
      return setError("Deductions cannot exceed earnings.");
    setBusy(true);
    setError("");
    try {
      const done = await api.staff.onboard(payload());
      const code = String(done.employee.code);
      const uploads: [string, File][] = [
        ["aadhaar_copy", aadhaar.file],
        ...(pan.file ? ([["pan_copy", pan.file]] as [string, File][]) : []),
        ...(bank.file ? ([["bank_proof", bank.file]] as [string, File][]) : []),
        ...certificates
          .filter((c) => c.file)
          .map((c) => [certificateKey(c.name), c.file!] as [string, File]),
        ...experience
          .filter((x) => x.organization.trim())
          .map(
            (x, i) =>
              [`experience_${i + 1}`, x.file] as [string, File | undefined],
          )
          .filter((e): e is [string, File] => !!e[1]),
      ];
      const failed: string[] = [];
      for (const [label, file] of uploads)
        try {
          await api.documents.upload({
            kind: "employee_document",
            person_code: code,
            filename: file.name,
            content_base64: await toBase64(file),
            document_label: label,
          });
        } catch (e) {
          failed.push(`${label.replaceAll("_", " ")}: ${errorText(e)}`);
        }
      setIssues(failed);
      setResult(done);
      onSaved?.(code);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const title = `Add ${STAFF_KIND_LABEL[kind]}`;
  return (
    <div
      className="enw-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form className="enw-shell stf-shell" onSubmit={save} noValidate={false}>
        <header className="enw-top">
          <div>
            <span className="enw-eyebrow">Staff onboarding</span>
            <h2>{result ? "Employee saved" : title}</h2>
          </div>
          <div className="stf-id">
            <span>Employee ID</span>
            <strong>
              {String(result?.employee.code || options?.employee_id || "…")}
            </strong>
            {!result && <small>assigned when saved</small>}
          </div>
          <button
            type="button"
            className="enw-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        {error && (
          <p className="enw-error" role="alert">
            {error}
          </p>
        )}

        <div className="enw-body">
          {result ? (
            <div className="enw-success">
              <CheckCircle2 size={34} />
              <div>
                <h3>
                  {person.first_name} {person.last_name} joined as{" "}
                  {job.designation}
                </h3>
                <p>
                  Employee ID <strong>{String(result.employee.code)}</strong>
                  {!labour &&
                    ` · Net pay ${inr(num(String(result.profile.net_monthly)))} a month`}
                </p>
                {issues.length > 0 && (
                  <p className="enw-warn">
                    Some files were not uploaded; upload them from the employee
                    record: {issues.join("; ")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <Card
                title={labour ? "Labourer" : "Personal details"}
                icon={<UserRound size={17} />}
              >
                <div className="enw-grid">
                  <Field label="First name *">
                    <input
                      required
                      value={person.first_name}
                      onChange={(e) =>
                        setPerson({ ...person, first_name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Last name *">
                    <input
                      required
                      value={person.last_name}
                      onChange={(e) =>
                        setPerson({ ...person, last_name: e.target.value })
                      }
                    />
                  </Field>
                  {!labour && (
                    <>
                      <Field label="Gender">
                        <select
                          value={person.gender}
                          onChange={(e) =>
                            setPerson({ ...person, gender: e.target.value })
                          }
                        >
                          <option value="">Select</option>
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="other">Other</option>
                        </select>
                      </Field>
                      <Field label="Date of birth">
                        <input
                          type="date"
                          value={person.date_of_birth}
                          onChange={(e) =>
                            setPerson({
                              ...person,
                              date_of_birth: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </>
                  )}
                  <Field label={labour ? "Phone number" : "Phone number *"}>
                    <PhoneInput
                      label="Phone number"
                      required={!labour}
                      code={phoneCode}
                      onCode={setPhoneCode}
                      value={person.phone}
                      onChange={(phone) => setPerson({ ...person, phone })}
                    />
                  </Field>
                  {!labour && (
                    <Field label="Email *">
                      <input
                        type="email"
                        required
                        value={person.email}
                        onChange={(e) =>
                          setPerson({ ...person, email: e.target.value })
                        }
                      />
                    </Field>
                  )}
                </div>
              </Card>

              <Card
                title={labour ? "Work" : "Job"}
                icon={<Briefcase size={17} />}
              >
                <div className="enw-grid">
                  <Field
                    label={labour ? "Role *" : "Designation *"}
                    hint={
                      labour
                        ? "e.g. Gardener, Cleaner, Helper"
                        : kind === "teaching"
                          ? "e.g. Lecturer, Assistant professor"
                          : "e.g. Accountant, Lab assistant"
                    }
                  >
                    <input
                      required
                      value={job.designation}
                      onChange={(e) =>
                        setJob({ ...job, designation: e.target.value })
                      }
                    />
                  </Field>
                  {!labour && (
                    <Field label="Department" hint="Pick or type a new one">
                      <input
                        list="stf-departments"
                        value={job.department}
                        onChange={(e) =>
                          setJob({ ...job, department: e.target.value })
                        }
                      />
                      <datalist id="stf-departments">
                        {options?.departments.map((d) => (
                          <option key={d} value={d} />
                        ))}
                      </datalist>
                    </Field>
                  )}
                  <Field label="Joining date *">
                    <input
                      type="date"
                      required
                      value={job.join_date}
                      onChange={(e) =>
                        setJob({ ...job, join_date: e.target.value })
                      }
                    />
                  </Field>
                  {!labour && (
                    <Field label="Employment type *">
                      <select
                        value={job.employment_type}
                        onChange={(e) =>
                          setJob({ ...job, employment_type: e.target.value })
                        }
                      >
                        <option value="permanent">Permanent</option>
                        <option value="contract">Contract</option>
                        <option value="part_time">Part time</option>
                      </select>
                    </Field>
                  )}
                </div>
              </Card>

              {!labour && (
                <Card title="Qualification" icon={<GraduationCap size={17} />}>
                  <div className="enw-grid">
                    <Field label="Highest qualification *">
                      <select
                        required
                        value={qualification.level}
                        onChange={(e) =>
                          setQualification({
                            ...qualification,
                            level: e.target.value as QualificationLevel,
                          })
                        }
                      >
                        <option value="">Select</option>
                        {QUALIFICATION_LEVELS.map((q) => (
                          <option key={q.value} value={q.value}>
                            {q.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Branch of specialization"
                      hint="e.g. M.Sc Physics, MBA Finance"
                    >
                      <input
                        value={qualification.specialization}
                        onChange={(e) =>
                          setQualification({
                            ...qualification,
                            specialization: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <p className="enw-label">Qualification certificates</p>
                  <div className="stf-add">
                    <input
                      aria-label="Certificate name"
                      placeholder="Type a certificate name and press Enter, e.g. M.Sc marks memo"
                      value={certificateName}
                      onChange={(e) => setCertificateName(e.target.value)}
                      onKeyDown={addCertificate}
                    />
                    <button
                      type="button"
                      onClick={() => addCertificate()}
                      disabled={!certificateName.trim()}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  {certificates.length > 0 && (
                    <ul className="stf-docs">
                      {certificates.map((c, i) => (
                        <li key={c.name}>
                          <span>{c.name}</span>
                          <FilePick
                            label="Upload"
                            file={c.file}
                            onChange={(file) =>
                              setCertificates(
                                certificates.map((x, j) =>
                                  j === i ? { ...x, file } : x,
                                ),
                              )
                            }
                          />
                          <button
                            type="button"
                            className="stf-remove"
                            aria-label={`Remove ${c.name}`}
                            onClick={() =>
                              setCertificates(
                                certificates.filter((_, j) => j !== i),
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              <Card title="Identity" icon={<IdCard size={17} />}>
                <div className="enw-grid enw-aadhaar">
                  <Field label="Aadhaar number *" hint="12 digits">
                    <input
                      required
                      inputMode="numeric"
                      pattern="[0-9]{4} ?[0-9]{4} ?[0-9]{4}"
                      value={aadhaar.number}
                      onChange={(e) =>
                        setAadhaar({ ...aadhaar, number: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label="Aadhaar copy *"
                    hint="PDF, JPG or PNG up to 650 KB"
                  >
                    <FilePick
                      label="Upload Aadhaar copy"
                      required
                      file={aadhaar.file}
                      onChange={(file) => setAadhaar({ ...aadhaar, file })}
                    />
                  </Field>
                  {!labour && (
                    <>
                      <Field label="PAN" hint="e.g. ABCDE1234F">
                        <input
                          pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
                          value={pan.number}
                          onChange={(e) =>
                            setPan({
                              ...pan,
                              number: e.target.value.toUpperCase(),
                            })
                          }
                        />
                      </Field>
                      <Field label="PAN card copy">
                        <FilePick
                          label="Upload PAN copy"
                          file={pan.file}
                          onChange={(file) => setPan({ ...pan, file })}
                        />
                      </Field>
                    </>
                  )}
                </div>
              </Card>

              {!labour && (
                <Card title="Contact address">
                  <div className="enw-grid">
                    <Field label="Address" wide>
                      <input
                        value={person.address}
                        onChange={(e) =>
                          setPerson({ ...person, address: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="City">
                      <input
                        value={person.city}
                        onChange={(e) =>
                          setPerson({ ...person, city: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="State">
                      <input
                        value={person.state}
                        onChange={(e) =>
                          setPerson({ ...person, state: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="PIN code">
                      <input
                        pattern="[0-9]{6}"
                        value={person.postal_code}
                        onChange={(e) =>
                          setPerson({ ...person, postal_code: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </Card>
              )}

              {!labour && (
                <Card
                  title="Previous experience"
                  icon={<Briefcase size={17} />}
                  aside={
                    <button
                      type="button"
                      onClick={() =>
                        setExperience([
                          ...experience,
                          {
                            organization: "",
                            role: "",
                            from_date: "",
                            to_date: "",
                            details: "",
                          },
                        ])
                      }
                    >
                      <Plus size={14} /> Add experience
                    </button>
                  }
                >
                  {experience.length === 0 && (
                    <p className="enw-muted">No previous experience added.</p>
                  )}
                  {experience.map((x, i) => {
                    const set = (patch: Partial<Experience>) =>
                      setExperience(
                        experience.map((y, j) =>
                          j === i ? { ...y, ...patch } : y,
                        ),
                      );
                    return (
                      <fieldset key={i} className="stf-entry">
                        <legend>
                          Experience {i + 1}
                          <button
                            type="button"
                            className="stf-remove"
                            aria-label="Remove experience"
                            onClick={() =>
                              setExperience(
                                experience.filter((_, j) => j !== i),
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </legend>
                        <div className="enw-grid">
                          <Field label="Organization *">
                            <input
                              required
                              value={x.organization}
                              onChange={(e) =>
                                set({ organization: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="Role">
                            <input
                              value={x.role}
                              onChange={(e) => set({ role: e.target.value })}
                            />
                          </Field>
                          <Field label="From">
                            <input
                              type="date"
                              value={x.from_date}
                              onChange={(e) =>
                                set({ from_date: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="To">
                            <input
                              type="date"
                              value={x.to_date}
                              onChange={(e) => set({ to_date: e.target.value })}
                            />
                          </Field>
                          <Field label="Details" wide>
                            <input
                              value={x.details}
                              onChange={(e) => set({ details: e.target.value })}
                            />
                          </Field>
                          <Field label="Experience certificate" wide>
                            <FilePick
                              label="Upload certificate"
                              file={x.file}
                              onChange={(file) => set({ file })}
                            />
                          </Field>
                        </div>
                      </fieldset>
                    );
                  })}
                </Card>
              )}

              {!labour && (
                <Card
                  title="Employment history"
                  aside={
                    <button
                      type="button"
                      onClick={() =>
                        setHistory([
                          ...history,
                          {
                            organization: "",
                            designation: "",
                            from_date: "",
                            to_date: "",
                            reason_for_leaving: "",
                          },
                        ])
                      }
                    >
                      <Plus size={14} /> Add employer
                    </button>
                  }
                >
                  {history.length === 0 && (
                    <p className="enw-muted">No employment history added.</p>
                  )}
                  {history.map((x, i) => {
                    const set = (patch: Partial<History>) =>
                      setHistory(
                        history.map((y, j) =>
                          j === i ? { ...y, ...patch } : y,
                        ),
                      );
                    return (
                      <div key={i} className="stf-row">
                        <input
                          aria-label="Organization"
                          placeholder="Organization"
                          value={x.organization}
                          onChange={(e) =>
                            set({ organization: e.target.value })
                          }
                        />
                        <input
                          aria-label="Designation"
                          placeholder="Designation"
                          value={x.designation}
                          onChange={(e) => set({ designation: e.target.value })}
                        />
                        <input
                          aria-label="From"
                          type="date"
                          value={x.from_date}
                          onChange={(e) => set({ from_date: e.target.value })}
                        />
                        <input
                          aria-label="To"
                          type="date"
                          value={x.to_date}
                          onChange={(e) => set({ to_date: e.target.value })}
                        />
                        <input
                          aria-label="Reason for leaving"
                          placeholder="Reason for leaving"
                          value={x.reason_for_leaving}
                          onChange={(e) =>
                            set({ reason_for_leaving: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="stf-remove"
                          aria-label="Remove employer"
                          onClick={() =>
                            setHistory(history.filter((_, j) => j !== i))
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </Card>
              )}

              {!labour && (
                <Card
                  title="Achievements"
                  icon={<Award size={17} />}
                  aside={
                    <button
                      type="button"
                      onClick={() =>
                        setAchievements([
                          ...achievements,
                          { title: "", year: "", details: "" },
                        ])
                      }
                    >
                      <Plus size={14} /> Add achievement
                    </button>
                  }
                >
                  {achievements.length === 0 && (
                    <p className="enw-muted">No achievements added.</p>
                  )}
                  {achievements.map((a, i) => {
                    const set = (patch: Partial<Achievement>) =>
                      setAchievements(
                        achievements.map((y, j) =>
                          j === i ? { ...y, ...patch } : y,
                        ),
                      );
                    return (
                      <div key={i} className="stf-row stf-row-3">
                        <input
                          aria-label="Achievement"
                          placeholder="Achievement, e.g. Best teacher award"
                          value={a.title}
                          onChange={(e) => set({ title: e.target.value })}
                        />
                        <input
                          aria-label="Year"
                          type="number"
                          placeholder="Year"
                          value={a.year}
                          onChange={(e) => set({ year: e.target.value })}
                        />
                        <input
                          aria-label="Details"
                          placeholder="Details"
                          value={a.details}
                          onChange={(e) => set({ details: e.target.value })}
                        />
                        <button
                          type="button"
                          className="stf-remove"
                          aria-label="Remove achievement"
                          onClick={() =>
                            setAchievements(
                              achievements.filter((_, j) => j !== i),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </Card>
              )}

              <Card title="Bank account" icon={<Banknote size={17} />}>
                <div className="enw-grid">
                  <Field label="Account holder name *">
                    <input
                      required
                      value={bank.account_holder}
                      onChange={(e) =>
                        setBank({ ...bank, account_holder: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Account number *">
                    <input
                      required
                      inputMode="numeric"
                      pattern="[0-9 ]{6,40}"
                      value={bank.account_number}
                      onChange={(e) =>
                        setBank({ ...bank, account_number: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Bank name *">
                    <input
                      required
                      value={bank.bank_name}
                      onChange={(e) =>
                        setBank({ ...bank, bank_name: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label="IFSC code *"
                    hint="11 characters, e.g. SBIN0001234"
                  >
                    <input
                      required
                      pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}"
                      value={bank.ifsc}
                      onChange={(e) =>
                        setBank({ ...bank, ifsc: e.target.value.toUpperCase() })
                      }
                    />
                  </Field>
                  <Field label="Branch">
                    <input
                      value={bank.branch}
                      onChange={(e) =>
                        setBank({ ...bank, branch: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Passbook / cancelled cheque">
                    <FilePick
                      label="Upload"
                      file={bank.file}
                      onChange={(file) => setBank({ ...bank, file })}
                    />
                  </Field>
                </div>
              </Card>

              <Card
                title={labour ? "Wage" : "Salary particulars"}
                icon={<Wallet size={17} />}
              >
                {labour ? (
                  <div className="enw-grid">
                    <Field label="Paid *">
                      <select
                        value={wage.basis}
                        onChange={(e) =>
                          setWage({
                            ...wage,
                            basis: e.target.value as
                              "daily" | "monthly" | "yearly",
                          })
                        }
                      >
                        <option value="daily">Daily</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </Field>
                    <Field
                      label={`Wage per ${wage.basis === "daily" ? "day" : wage.basis === "monthly" ? "month" : "year"} *`}
                    >
                      <input
                        type="number"
                        min={1}
                        step="0.01"
                        required
                        value={wage.amount}
                        onChange={(e) =>
                          setWage({ ...wage, amount: e.target.value })
                        }
                      />
                    </Field>
                    <div className="stf-estimate">
                      <span>About {inr(wageMonthly)} a month</span>
                      {wage.basis === "daily" && (
                        <small>at 26 working days</small>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="enw-muted">
                      Monthly breakdown in this organization. Empty rows are
                      ignored.
                    </p>
                    <table className="stf-salary">
                      <thead>
                        <tr>
                          <th>Component</th>
                          <th>Type</th>
                          <th>Monthly amount</th>
                          <th aria-label="Remove" />
                        </tr>
                      </thead>
                      <tbody>
                        {components.map((c, i) => {
                          const set = (patch: Partial<Component>) =>
                            setComponents(
                              components.map((y, j) =>
                                j === i ? { ...y, ...patch } : y,
                              ),
                            );
                          return (
                            <tr key={i} className={c.component_type}>
                              <td>
                                <input
                                  aria-label="Component"
                                  value={c.component}
                                  onChange={(e) =>
                                    set({ component: e.target.value })
                                  }
                                />
                              </td>
                              <td>
                                <select
                                  aria-label="Type"
                                  value={c.component_type}
                                  onChange={(e) =>
                                    set({
                                      component_type: e.target
                                        .value as Component["component_type"],
                                    })
                                  }
                                >
                                  <option value="earning">Earning</option>
                                  <option value="deduction">Deduction</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  aria-label={`${c.component} amount`}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={c.amount}
                                  onChange={(e) =>
                                    set({ amount: e.target.value })
                                  }
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="stf-remove"
                                  aria-label={`Remove ${c.component}`}
                                  onClick={() =>
                                    setComponents(
                                      components.filter((_, j) => j !== i),
                                    )
                                  }
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      className="stf-add-row"
                      onClick={() =>
                        setComponents([
                          ...components,
                          {
                            component: "",
                            component_type: "earning",
                            amount: "",
                          },
                        ])
                      }
                    >
                      <Plus size={14} /> Add component
                    </button>
                    <dl className="stf-totals">
                      <div>
                        <dt>Gross pay</dt>
                        <dd>{inr(totals.earnings)}</dd>
                      </div>
                      <div>
                        <dt>Deductions</dt>
                        <dd>- {inr(totals.deductions)}</dd>
                      </div>
                      <div className="stf-net">
                        <dt>Net pay</dt>
                        <dd>{inr(totals.net)}</dd>
                      </div>
                    </dl>
                    <div className="enw-grid">
                      <Field
                        label="In-hand pay (monthly)"
                        hint={`Defaults to net pay, ${inr(totals.net)}`}
                      >
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={inHand}
                          placeholder={totals.net ? totals.net.toFixed(2) : ""}
                          onChange={(e) => setInHand(e.target.value)}
                        />
                      </Field>
                      <Field
                        label="Current package (CTC, yearly)"
                        hint={`Defaults to gross × 12, ${inr(totals.earnings * 12)}`}
                      >
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={ctc}
                          placeholder={
                            totals.earnings
                              ? (totals.earnings * 12).toFixed(2)
                              : ""
                          }
                          onChange={(e) => setCtc(e.target.value)}
                        />
                      </Field>
                    </div>
                  </>
                )}
              </Card>
            </>
          )}
        </div>

        <footer className="enw-footer">
          {result ? (
            <button type="button" className="enw-primary" onClick={onClose}>
              Done
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button className="enw-primary" disabled={busy || !options}>
                {busy ? "Saving…" : `Save ${STAFF_KIND_LABEL[kind]}`}
              </button>
            </>
          )}
        </footer>
      </form>
    </div>
  );
}
