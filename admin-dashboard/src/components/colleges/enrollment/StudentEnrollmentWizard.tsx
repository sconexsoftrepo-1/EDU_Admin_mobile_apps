"use client";
import SearchField, { searchValues } from "../SearchField";
/**
 * Student enrollment wizard (the admission form of the college).
 *   Step 1  Student details: photo, student, last qualification, documents, guardian, Aadhaar,
 *           referral, achievements and certifications.
 *   Step 2  Course & fees: admission/registration numbers, level and branch, hostel and bus,
 *           fee breakdown with scholarship and special consideration, summary card.
 *   Step 3  Review & confirm: full review, print, PDF and CSV; confirm enrolls the student and
 *           uploads the files (photo, Aadhaar copy, ticked certificates).
 * One POST master-data/enrollment writes the enrollment; files follow via documents/upload.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Bus,
  Camera,
  Check,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  IdCard,
  Paperclip,
  Plus,
  Printer,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  ENROLLMENT_DOCUMENTS,
  ApiError,
  api,
  errorText,
  type CourseLevel,
  type EnrollmentOptions,
  type EnrollmentGuardian,
  type EnrollmentPayload,
  type EnrollmentResult,
  type FeeLine,
} from "@/services/api";
import type { College } from "@/data/colleges";
import { csv } from "@/lib/colleges/download";
import "./enrollment-wizard.css";
import { COURSE_LEVELS } from "@/lib/colleges/course-levels";
import { toast } from "../toast";
import Select from "../SearchSelect";
import { PhoneInput } from "../CountryCodePicker";
import { UploadButton } from "../UploadBox";
import DateInput, { formatDate } from "../DateInput";
import AcademicYearForm from "../AcademicYearForm";

const MAX_FILE = 650_000; // backend upload limit (bytes)
const BOARDS = ["SSC (State board)", "CBSE", "ICSE", "Other"];
const GROUPS = ["MPC", "BPC", "MEC", "CEC", "HEC", "Other"];
const STEPS = ["Student details", "Course & fees", "Review & confirm"];

type Guardian = EnrollmentGuardian;
type Achievement = {
  title: string;
  level: string;
  year: string;
  description: string;
};
type Certificate = { name: string; issuer: string; year: string };
type Files = Record<string, File | undefined>;

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
const num = (value: string | number | undefined) => Number(value || 0) || 0;
const QUALIFICATION_LEVELS = [
  ["ssc", "10th class"],
  ["intermediate", "Intermediate"],
  ["polytechnic", "Polytechnic"],
  ["degree", "Degree (UG)"],
  ["pg", "Post graduation"],
  ["bped", "B.P.Ed"],
  ["mped", "M.P.Ed"],
  ["other", "Other"],
] as const;
/** Course and semester details apply to every qualification after Intermediate. */
const HAS_SEMESTERS = new Set(["polytechnic", "degree", "pg", "bped", "mped", "other"]);
const COURSE_LABEL: Record<string, string> = {
  polytechnic: "Branch *",
  degree: "Degree course *",
  pg: "PG course *",
  bped: "Specialization",
  mped: "Specialization",
  other: "Course name *",
};
const COURSE_HINT: Record<string, string> = {
  degree: "e.g. B.Sc MPCs, B.Com, BA",
  pg: "e.g. M.Sc Physics, MBA, MA",
};
type QualificationLevel = (typeof QUALIFICATION_LEVELS)[number][0];
type QualificationEntry = {
  id: number;
  level: QualificationLevel;
  institution: string;
  board: string;
  group: string;
  grade: string;
  first_year_score: string;
  second_year_score: string;
  semesters: { semester: string; score: string }[];
  total_percentage: string;
  passed_year: string;
};
const newQualification = (
  id: number,
  level: QualificationLevel = "ssc",
): QualificationEntry => ({
  id,
  level,
  institution: "",
  board: BOARDS[0],
  group: level === "intermediate" ? "MPC" : "",
  grade: "",
  first_year_score: "",
  second_year_score: "",
  semesters: [],
  total_percentage: "",
  passed_year: "",
});
const qualificationName = (q: QualificationEntry) =>
  [
    QUALIFICATION_LEVELS.find(([value]) => value === q.level)?.[1],
    q.level === "ssc" ? "" : q.group,
  ]
    .filter(Boolean)
    .join(" ");
const qualificationScore = (q: QualificationEntry) =>
  q.level === "ssc"
    ? q.grade
    : q.total_percentage || q.second_year_score || q.first_year_score;
type BankForm = {
  account_holder: string;
  account_number: string;
  bank_name: string;
  ifsc: string;
  branch: string;
};
const EMPTY_BANK: BankForm = {
  account_holder: "",
  account_number: "",
  bank_name: "",
  ifsc: "",
  branch: "",
};
const BANK_OWNERS = [
  ["student", "Student"],
  ["mother", "Mother"],
] as const;
/** The API stores name parts; a one-word name is used for both, as the public form does. */
const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts.slice(0, -1).join(" ") || parts[0] || "",
    last_name: parts.at(-1) || "",
  };
};
const lastFour = (number: string) =>
  number ? `•••• ${number.slice(-4)}` : "—";

/** Normalize camera/selected images to a format and size accepted by document storage. */
export async function fitImage(
  file: File | Blob,
  name = "photo.jpg",
): Promise<File> {
  if (
    file.size <= MAX_FILE &&
    file instanceof File &&
    ["image/jpeg", "image/png"].includes(file.type)
  )
    return file;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    for (const [factor, quality] of [
      [1, 0.85],
      [0.75, 0.7],
      [0.5, 0.55],
    ]) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale * factor));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale * factor));
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Unable to prepare this photo. Choose another image.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Unable to encode this photo.")),
          "image/jpeg",
          quality,
        ),
      );
      if (blob.size <= MAX_FILE)
        return new File([blob], name.replace(/\.\w+$/, "") + ".jpg", {
          type: "image/jpeg",
        });
    }
    throw new Error(
      "Photo exceeds 650 KB after resizing. Choose a smaller image.",
    );
  } finally {
    bitmap.close();
  }
}

export function toBase64(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    let raw = "";
    new Uint8Array(buffer).forEach((b) => (raw += String.fromCharCode(b)));
    return btoa(raw);
  });
}

function dataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Card({
  title,
  icon,
  children,
  aside,
  asideInline,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  /** Show `aside` right beside the title instead of at the far right. */
  asideInline?: boolean;
}) {
  return (
    <section className="enw-card">
      <header className={asideInline ? "enw-card-head-inline" : undefined}>
        <h3>
          {icon}
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
  wide,
  hint,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  hint?: string;
}) {
  return (
    <label className={wide ? "enw-field enw-wide" : "enw-field"}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

/** Shrinks images and enforces the upload limit; returns the file or an error message. */
async function checkUpload(picked: File): Promise<File | string> {
  const fitted = picked.type.startsWith("image/")
    ? await fitImage(picked, picked.name)
    : picked;
  return fitted.size > MAX_FILE
    ? "Maximum 650 KB; scan at a lower resolution"
    : fitted;
}

/** ID number field with its document upload inside the same box (Aadhaar, PAN). */
export function IdWithUpload({
  value,
  onValue,
  file,
  onFile,
  fileRequired,
  fileLabel,
  accept = ".pdf,.png,.jpg,.jpeg",
  ...input
}: {
  value: string;
  onValue: (value: string) => void;
  file?: File;
  onFile: (file?: File) => void;
  fileRequired?: boolean;
  fileLabel: string;
  accept?: string;
  required?: boolean;
  inputMode?: "numeric" | "text";
  pattern?: string;
  placeholder?: string;
  maxLength?: number;
  title?: string;
}) {
  const [error, setError] = useState("");
  return (
    <span className="enw-file enw-idfile">
      <span className="upl-box">
        <input
          {...input}
          className="upl-input"
          value={value}
          onChange={(e) => onValue(e.target.value)}
        />
        <UploadButton
          label={fileLabel}
          hasFile={!!file}
          accept={accept}
          required={fileRequired && !file}
          onChange={async (e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            setError("");
            if (!picked) return;
            const checked = await checkUpload(picked);
            if (typeof checked === "string") setError(checked);
            else onFile(checked);
          }}
        />
      </span>
      {file && (
        <span className="enw-idfile-chip">
          <FileText size={13} aria-hidden="true" />
          <span>
            {file.name} · {Math.round(file.size / 1024)} KB
          </span>
          <button
            type="button"
            aria-label={`Remove ${fileLabel}`}
            onClick={(e) => {
              e.preventDefault();
              onFile(undefined);
            }}
          >
            <X size={13} />
          </button>
        </span>
      )}
      {error && <em role="alert">{error}</em>}
    </span>
  );
}

export function FilePick({
  file,
  onChange,
  required,
  accept = ".pdf,.png,.jpg,.jpeg",
  label,
}: {
  file?: File;
  onChange: (file?: File) => void;
  required?: boolean;
  accept?: string;
  label: string;
}) {
  const [error, setError] = useState("");
  return (
    <span className="enw-file">
      <span className="upl-box">
        <span className={file ? "upl-text" : "upl-text is-empty"}>
          {file
            ? `${file.name} · ${Math.round(file.size / 1024)} KB`
            : "No file chosen"}
        </span>
        {file && (
          <button
            type="button"
            className="upl-remove"
            aria-label="Remove file"
            onClick={(e) => {
              e.preventDefault();
              onChange(undefined);
            }}
          >
            <X size={14} />
          </button>
        )}
        <UploadButton
          label={label}
          hasFile={!!file}
          accept={accept}
          required={required && !file}
          onChange={async (e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            setError("");
            if (!picked) return;
            const checked = await checkUpload(picked);
            if (typeof checked === "string") setError(checked);
            else onChange(checked);
          }}
        />
      </span>
      {error && <em role="alert">{error}</em>}
    </span>
  );
}

function PhotoCapture({
  photo,
  preview,
  onChange,
}: {
  photo?: File;
  preview: string;
  onChange: (file?: File) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  async function open() {
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(media);
      requestAnimationFrame(() => {
        if (video.current) video.current.srcObject = media;
      });
    } catch {
      setError("Camera unavailable; upload a photo instead.");
    }
  }
  async function take() {
    const v = video.current;
    if (!v) return;
    setError("");
    try {
      if (!v.videoWidth || !v.videoHeight)
        throw new Error("Wait for the camera preview before taking a photo.");
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error(
          "Unable to capture the photo. Upload an image instead.",
        );
      context.drawImage(v, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Unable to capture the photo.")),
          "image/jpeg",
          0.9,
        ),
      );
      onChange(await fitImage(blob, "student-photo.jpg"));
      stream?.getTracks().forEach((t) => t.stop());
      setStream(null);
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <div className="enw-photo">
      <div className="enw-photo-frame">
        {stream ? (
          <video ref={video} autoPlay playsInline muted />
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Student" />
        ) : (
          <UserRound size={54} />
        )}
      </div>
      <div className="enw-photo-actions">
        <strong>Student photo</strong>
        <small>Passport-size, face clearly visible.</small>
        {stream ? (
          <span>
            <button type="button" className="enw-primary" onClick={take}>
              <Camera size={15} /> Take photo
            </button>
            <button
              type="button"
              onClick={() => {
                stream.getTracks().forEach((t) => t.stop());
                setStream(null);
              }}
            >
              Cancel
            </button>
          </span>
        ) : (
          <span>
            <label className="enw-file-button">
              <Upload size={15} /> Upload
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={async (e) => {
                  const input = e.currentTarget;
                  const f = input.files?.[0];
                  if (!f) return;
                  setError("");
                  try {
                    onChange(await fitImage(f, f.name));
                  } catch {
                    setError(
                      "Unable to read this photo. Choose a valid JPEG, PNG or WebP image.",
                    );
                  } finally {
                    input.value = "";
                  }
                }}
              />
            </label>
            <button type="button" onClick={open}>
              <Camera size={15} /> Capture
            </button>
            {photo && (
              <button type="button" onClick={() => onChange(undefined)}>
                Remove
              </button>
            )}
          </span>
        )}
        {error && <em role="alert">{error}</em>}
      </div>
    </div>
  );
}

export { PhoneInput } from "../CountryCodePicker";

export default function StudentEnrollmentWizard({
  college,
  onClose,
  onEnrolled,
  initialApplicant,
}: {
  college: College;
  onClose: () => void;
  onEnrolled?: (studentCode: string) => void;
  initialApplicant?: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    parent_name?: string;
    parent_phone?: string;
    program_code?: string;
    academic_year_code?: string;
    course_level?: CourseLevel;
  };
}) {
  const [step, setStep] = useState(0);
  const [options, setOptions] = useState<EnrollmentOptions | null>(null);
  const [quote, setQuote] = useState<EnrollmentOptions | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EnrollmentResult | null>(null);
  const [uploadIssues, setUploadIssues] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File>();
  // One preview URL per photo, shared by the capture panel, summary and review; freed on change.
  const photoUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : ""),
    [photo],
  );
  useEffect(
    () => () => void (photoUrl && URL.revokeObjectURL(photoUrl)),
    [photoUrl],
  );
  const [files, setFiles] = useState<Files>({});
  const [student, setStudent] = useState({
    complete_name: [initialApplicant?.first_name, initialApplicant?.last_name]
      .filter(Boolean)
      .join(" "),
    date_of_birth: "",
    gender: "",
    email: initialApplicant?.email || "",
    phone: String(initialApplicant?.phone || "").replace(/^\+?91\s*/, ""),
    aadhaar_number: "",
    blood_group: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
    campus_code: "",
  });
  const [qualifications, setQualifications] = useState<QualificationEntry[]>([
    newQualification(1),
  ]);
  const qualificationId = useRef(1);
  const updateQualification = (
    id: number,
    patch: Partial<QualificationEntry>,
  ) =>
    setQualifications((items) =>
      items.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  const latestQualification = qualifications.at(-1);
  const [identity, setIdentity] = useState({
    sachivalayam_code: "",
    sachivalayam_name: "",
    apar_id: "",
  });
  const [banks, setBanks] = useState<Record<"student" | "mother", BankForm>>({
    student: EMPTY_BANK,
    mother: EMPTY_BANK,
  });
  const bankStarted = (owner: "student" | "mother") =>
    Object.values(banks[owner]).some((value) => value.trim()) ||
    !!files[`bank_passbook_${owner}`];
  const bankPayload = (owner: "student" | "mother") => {
    if (!bankStarted(owner)) return undefined;
    const bank = banks[owner];
    return {
      account_holder: bank.account_holder.trim(),
      account_number: bank.account_number.trim(),
      bank_name: bank.bank_name.trim(),
      ifsc: bank.ifsc.trim(),
      branch: bank.branch.trim() || undefined,
    };
  };
  const [admissionInput, setAdmissionInput] = useState("");
  const [documents, setDocuments] = useState<Record<string, boolean>>({});
  // Country codes of the phone numbers; saved with the number ("+91 9876543210").
  const [codes, setCodes] = useState({
    student: "+91",
    phone: "+91",
    alternate: "+91",
    referral: "+91",
  });
  const withCode = (code: string, number?: string) =>
    number?.trim() ? `${code} ${number.trim()}` : "";
  const [family, setFamily] = useState({
    father_name: String(initialApplicant?.parent_name || "").trim(),
    mother_name: "",
    has_other: false,
    guardian_name: "",
    guardian_relationship: "",
    primary_phone: String(initialApplicant?.parent_phone || "").replace(
      /^\+?91\s*/,
      "",
    ),
    secondary_phone: "",
  });
  // The contact linked as the student's parent record: the other guardian when ticked.
  const contactName = family.has_other
    ? family.guardian_name.trim()
    : family.father_name.trim() || family.mother_name.trim();
  const contactRelationship: Guardian["relationship"] = family.has_other
    ? "guardian"
    : family.father_name.trim()
      ? "father"
      : "mother";
  const [referred, setReferred] = useState(false);
  const [referral, setReferral] = useState({
    name: "",
    relation: "",
    mobile: "",
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [course, setCourse] = useState({
    level: (initialApplicant?.course_level || "intermediate") as CourseLevel,
    program_code: initialApplicant?.program_code || "",
    academic_year_code: initialApplicant?.academic_year_code || "",
  });
  const [courseQuery, setCourseQuery] = useState("");
  const [courseFamily, setCourseFamily] = useState("");
  const [academicYearFormOpen, setAcademicYearFormOpen] = useState(false);
  const [hostel, setHostel] = useState(false);
  const [transport, setTransport] = useState(false);
  const [scholarship, setScholarship] = useState({ amount: "", name: "" });
  const [special, setSpecial] = useState({ amount: "", reason: "" });
  const stepOne = useRef<HTMLFormElement>(null);
  const stepTwo = useRef<HTMLFormElement>(null);

  useEffect(() => {
    void api.masterData
      .enrollmentOptions()
      .then((value) => {
        setOptions(value);
        if (value.campuses.length === 1)
          setStudent((s) => ({ ...s, campus_code: value.campuses[0].code }));
      })
      .catch((e) => {
        const text =
          e instanceof ApiError && e.status === 404
            ? "The backend does not serve the enrollment wizard yet: restart it (uvicorn app.asgi:app --host 127.0.0.1 --port 8010) and open the form again."
            : errorText(e);
        setError(text);
        toast.error("Could not load enrollment options", text);
      });
  }, []);
  useEffect(() => {
    if (!course.academic_year_code) return;
    let active = true;
    void api.masterData
      .enrollmentOptions({
        academic_year_code: course.academic_year_code,
        program_code: course.program_code || undefined,
      })
      .then((value) => {
        if (active) setQuote(value);
      })
      .catch((e) => {
        if (!active) return;
        setError(errorText(e));
        toast.error("Could not load fee details", errorText(e));
      });
    return () => {
      active = false;
    };
  }, [course.academic_year_code, course.program_code]);

  const documentList = options?.documents?.length
    ? options.documents
    : ENROLLMENT_DOCUMENTS;
  const programs = options?.courses[course.level] || [];
  const families = Array.from(
    new Set(programs.map((p) => p.category).filter(Boolean) as string[]),
  );
  const visiblePrograms = programs.filter(
    (p) =>
      (!courseFamily || p.category === courseFamily) &&
      `${p.name} ${p.branch || ""} ${p.qualification || ""}`
        .toLowerCase()
        .includes(courseQuery.trim().toLowerCase()),
  );
  const program = programs.find((p) => p.code === course.program_code);
  const academicYears = (options?.academic_years || []).filter(
    (y) =>
      Boolean(course.program_code) && y.program_code === course.program_code,
  );
  const year = options?.academic_years.find(
    (y) => y.code === course.academic_year_code,
  );
  const startYear = Number(year?.start_date.slice(0, 4));
  const batch = program?.batches.find((b) =>
    year?.batch_code ? b.code === year.batch_code : b.entry_year === startYear,
  );
  const fees: FeeLine[] = useMemo(
    () =>
      (course.program_code ? quote?.fees_available || [] : []).filter(
        (f) =>
          f.category === "academic" ||
          f.category === "other" ||
          (f.category === "hostel" && hostel) ||
          (f.category === "transport" && transport),
      ),
    [quote, course.program_code, hostel, transport],
  );
  const fullCourseFees =
    fees.length > 0 && fees.every((f) => f.fee_basis === "full_course");
  const termCount = fullCourseFees
    ? Number(fees[0]?.term_count || program?.duration_semesters || 4)
    : 0;
  const hostelFee = (quote?.fees_available || [])
    .filter((f) => f.category === "hostel")
    .reduce((n, f) => n + num(f.amount), 0);
  const busFee = (quote?.fees_available || [])
    .filter((f) => f.category === "transport")
    .reduce((n, f) => n + num(f.amount), 0);
  const gross = fees.reduce((n, f) => n + num(f.amount), 0);
  const academicFee = fees
    .filter((f) => f.category === "academic" || f.category === "other")
    .reduce((n, f) => n + num(f.amount), 0);
  const concession = num(scholarship.amount) + num(special.amount);
  const net = Math.max(0, gross - concession);

  function payload(): EnrollmentPayload {
    const s = student;
    return {
      student: {
        complete_name: s.complete_name.trim().replace(/\s+/g, " "),
        date_of_birth: s.date_of_birth,
        gender: s.gender as EnrollmentPayload["student"]["gender"],
        email: s.email.trim() || undefined,
        phone: withCode(codes.student, s.phone),
        aadhaar_number: s.aadhaar_number.replace(/\s/g, ""),
        blood_group: s.blood_group || undefined,
        address: s.address.trim(),
        city: s.city.trim(),
        state: s.state.trim(),
        postal_code: s.postal_code.trim(),
        country: s.country.trim() || "India",
        campus_code: s.campus_code || undefined,
      },
      admission_number: admissionInput.trim(),
      qualifications: qualifications.map((q) => ({
        level: q.level,
        institution: q.institution.trim(),
        board: q.level === "ssc" ? q.board : undefined,
        group: q.level === "ssc" ? undefined : q.group.trim() || undefined,
        grade: q.level === "ssc" ? q.grade.trim() || undefined : undefined,
        first_year_score:
          q.level === "intermediate"
            ? q.first_year_score.trim() || undefined
            : undefined,
        second_year_score:
          q.level === "intermediate"
            ? q.second_year_score.trim() || undefined
            : undefined,
        semester_scores: q.semesters
          .filter((row) => row.score.trim())
          .map((row) => ({
            semester: row.semester.trim(),
            score: row.score.trim(),
          })),
        total_percentage:
          q.level === "ssc" ? undefined : q.total_percentage.trim() || undefined,
        passed_year: num(q.passed_year) || undefined,
      })),
      family: {
        father_name: family.father_name.trim() || undefined,
        mother_name: family.mother_name.trim() || undefined,
        guardian_name: family.has_other
          ? family.guardian_name.trim()
          : undefined,
        guardian_relationship: family.has_other
          ? family.guardian_relationship.trim()
          : undefined,
      },
      identity: {
        sachivalayam_code: identity.sachivalayam_code.trim() || undefined,
        sachivalayam_name: identity.sachivalayam_name.trim() || undefined,
        apar_id: identity.apar_id.trim() || undefined,
      },
      bank_accounts: {
        student: bankPayload("student"),
        mother: bankPayload("mother"),
      },
      guardian: {
        relationship: contactRelationship,
        ...splitName(contactName),
        phone: withCode(codes.phone, family.primary_phone),
        alternate_phone:
          withCode(codes.alternate, family.secondary_phone) || undefined,
      },
      documents,
      referral: referred
        ? { ...referral, mobile: withCode(codes.referral, referral.mobile) }
        : null,
      achievements: achievements
        .filter((a) => a.title.trim())
        .map((a) => ({
          title: a.title.trim(),
          level: a.level || undefined,
          year: num(a.year) || undefined,
          description: a.description || undefined,
        })),
      certifications: certificates
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          issuer: c.issuer || undefined,
          year: num(c.year) || undefined,
        })),
      course: {
        course_level: course.level,
        program_code: course.program_code,
        academic_year_code: course.academic_year_code,
        batch_code: batch?.code,
      },
      hostel_required: hostel,
      transport_required: transport,
      scholarship: num(scholarship.amount)
        ? {
            amount: num(scholarship.amount).toFixed(2),
            name: scholarship.name || undefined,
          }
        : null,
      special_consideration: num(special.amount)
        ? { amount: num(special.amount).toFixed(2), reason: special.reason }
        : null,
    };
  }

  function next() {
    setError("");
    const warn = (text: string) => {
      setError(text);
      toast.warning(text);
    };
    if (step === 0) {
      if (!stepOne.current?.reportValidity()) return;
      if (!files.aadhaar_copy)
        return warn("Upload the Aadhaar copy (mandatory).");
    }
    if (step === 1) {
      if (!stepTwo.current?.reportValidity()) return;
      if (!program) return warn("Choose the course and specialization.");
      if (!year || year.program_code !== program.code)
        return warn("Select a batch for the chosen course.");
      if (concession > academicFee)
        return warn(
          "Scholarship and special consideration cannot exceed the academic fee.",
        );
    }
    setStep((s) => Math.min(2, s + 1));
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const done = await api.masterData.enroll(payload());
      const code = String(done.student.code);
      const uploads: [string, File][] = [
        ...(photo ? ([["student_photo", photo]] as [string, File][]) : []),
        ...Object.entries(files).filter(
          (e): e is [string, File] =>
            !!e[1] &&
            (e[0] === "aadhaar_copy" ||
              e[0].startsWith("bank_passbook_") ||
              documents[e[0]]),
        ),
      ];
      const issues: string[] = [];
      for (const [label, file] of uploads)
        try {
          await api.documents.upload({
            kind: "student_document",
            person_code: code,
            filename: file.name,
            content_base64: await toBase64(file),
            document_label: label,
          });
        } catch (e) {
          issues.push(`${label.replaceAll("_", " ")}: ${errorText(e)}`);
        }
      setUploadIssues(issues);
      setResult(done);
      onEnrolled?.(code);
      if (issues.length)
        toast.warning(
          "Student added, but some documents did not upload",
          issues.join("; "),
        );
      else toast.success("Student added successfully!", `Student ID ${code}`);
    } catch (e) {
      setError(errorText(e));
      toast.error("Failed to add student. Please try again.", errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // ---- review data shared by the review card, PDF and CSV ---------------------------------
  const admissionNumber = String(
    result?.student.admission_number || admissionInput.trim() || "—",
  );
  const referenceNumber = String(
    result?.profile.reference_number || quote?.admission_number || "—",
  );
  const studentName = student.complete_name.trim().replace(/\s+/g, " ");
  const registrationNumber = String(
    result?.profile.registration_number || quote?.registration_number || "—",
  );
  const docLabel = (key: string) =>
    documentList.find((d) => d.key === key)?.label ||
    options?.identity_documents.find((d) => d.key === key)?.label ||
    key;
  const sections = (): {
    title: string;
    fields?: [string, string][];
    columns?: string[];
    rows?: string[][];
  }[] => [
    {
      title: "Admission",
      fields: [
        ["Admission number", admissionNumber],
        ["Reference number", referenceNumber],
        ["Registration number", registrationNumber],
        ["Batch", year?.name || "—"],
        [
          "Course level",
          course.level === "intermediate" ? "Intermediate" : "Degree",
        ],
        [
          "Course / specialization",
          program
            ? `${program.name}${program.branch ? ` (${program.branch})` : ""}`
            : "—",
        ],

        ["Hostel", hostel ? "Required" : "Not required"],
        ["College bus", transport ? "Required" : "Not required"],
      ],
    },
    {
      title: "Student",
      fields: [
        ["Complete name as per SSC", studentName],
        ["Date of birth", formatDate(student.date_of_birth)],
        ["Gender", student.gender.replaceAll("_", " ")],
        ["Contact number", withCode(codes.student, student.phone)],
        ["Email", student.email || "—"],
        [
          "Aadhaar number",
          student.aadhaar_number.replace(/(\d{4})(?=\d)/g, "$1 "),
        ],
        ["Blood group", student.blood_group || "—"],
        ["Sachivalayam code", identity.sachivalayam_code || "—"],
        ["Sachivalayam name", identity.sachivalayam_name || "—"],
        ["DigiLocker / APAR ID", identity.apar_id || "—"],
        [
          "Address",
          [student.address, student.city, student.state, student.postal_code]
            .filter(Boolean)
            .join(", "),
        ],
      ],
    },
    {
      title: "Qualifications",
      columns: ["Qualification", "School / college", "Year passed", "Score"],
      rows: qualifications.map((q) => [
        qualificationName(q),
        q.institution,
        q.passed_year || "—",
        [
          qualificationScore(q),
          ...q.semesters
            .filter((row) => row.score)
            .map((row) => `${row.semester}: ${row.score}`),
        ]
          .filter(Boolean)
          .join(" · ") || "—",
      ]),
    },
    {
      title: "Family details",
      fields: [
        ["Father name as per SSC", family.father_name || "—"],
        ["Mother name as per SSC", family.mother_name || "—"],
        ...(family.has_other
          ? ([
              ["Guardian name as per SSC", family.guardian_name],
              ["Guardian relation", family.guardian_relationship],
            ] as [string, string][])
          : []),
        ["Primary contact number", withCode(codes.phone, family.primary_phone)],
        [
          "Secondary contact number",
          withCode(codes.alternate, family.secondary_phone) || "—",
        ],
      ],
    },
    ...BANK_OWNERS.filter(([owner]) => bankStarted(owner)).map(
      ([owner, label]) => ({
        title: `${label} bank account`,
        fields: [
          ["Account holder", banks[owner].account_holder],
          ["Account number", lastFour(banks[owner].account_number)],
          ["Bank", banks[owner].bank_name],
          ["IFSC", banks[owner].ifsc],
          ["Branch", banks[owner].branch || "—"],
          [
            "Passbook first page",
            files[`bank_passbook_${owner}`]?.name || "Not uploaded",
          ],
        ] as [string, string][],
      }),
    ),
    {
      title: "Documents",
      columns: ["Document", "Submitted", "File"],
      rows: [
        ["Aadhaar copy", "Yes", files.aadhaar_copy?.name || "—"],
        ["Student photo", photo ? "Yes" : "No", photo?.name || "—"],
        ...Object.entries(documents)
          .filter(([, v]) => v)
          .map(([k]) => [
            docLabel(k),
            "Yes",
            files[k]?.name || "To be uploaded later",
          ]),
      ],
    },
    ...(referred
      ? [
          {
            title: "Referral",
            fields: [
              ["Name", referral.name],
              ["Relation to organization", referral.relation],
              ["Mobile", withCode(codes.referral, referral.mobile)],
            ] as [string, string][],
          },
        ]
      : []),
    ...(achievements.some((a) => a.title)
      ? [
          {
            title: "Academic achievements",
            columns: ["Achievement", "Level", "Year"],
            rows: achievements
              .filter((a) => a.title)
              .map((a) => [a.title, a.level || "—", a.year || "—"]),
          },
        ]
      : []),
    ...(certificates.some((c) => c.name)
      ? [
          {
            title: "Certifications (NCC, NSS, sports, ...)",
            columns: ["Certificate", "Issued by", "Year"],
            rows: certificates
              .filter((c) => c.name)
              .map((c) => [c.name, c.issuer || "—", c.year || "—"]),
          },
        ]
      : []),
    {
      title: fullCourseFees
        ? "Fee breakdown (full course)"
        : "Fee breakdown (first year)",
      columns: ["Fee", "Category", "Due date", "Amount"],
      rows: [
        ...fees.map((f) => [
          f.name,
          f.category,
          f.due_date,
          inr(num(f.amount)),
        ]),
        ["Gross fee", "", "", inr(gross)],
        ...(num(scholarship.amount)
          ? [
              [
                `Scholarship${scholarship.name ? ` (${scholarship.name})` : ""}`,
                "concession",
                "",
                "- " + inr(num(scholarship.amount)),
              ],
            ]
          : []),
        ...(num(special.amount)
          ? [
              [
                `Special consideration (${special.reason})`,
                "concession",
                "",
                "- " + inr(num(special.amount)),
              ],
            ]
          : []),
        ["Net payable", "", "", inr(net)],
      ],
    },
  ];
  // Numbers and course shown once, in the header; the sections below hold everything else.
  const headline = (): [string, string][] => [
    ["Admission no.", admissionNumber],
    ["Reference no.", referenceNumber],
    ["Registration no.", registrationNumber],
    ["Batch", year?.name || "—"],
    [
      "Course",
      program
        ? `${program.name}${program.branch ? ` (${program.branch})` : ""}`
        : "—",
    ],
    ["Date", formatDate(new Date().toISOString().slice(0, 10))],
  ];
  async function pdf() {
    const { enrollmentPdf } = await import("@/lib/colleges/enrollment-pdf");
    await enrollmentPdf(`admission-${admissionNumber}`, {
      college: college.name,
      title: "Student admission form",
      photo: photo ? await dataUrl(photo) : undefined,
      numbers: headline(),
      sections: sections().map((s) =>
        s.title === "Admission"
          ? {
              ...s,
              title: "Course & facilities",
              fields: s.fields!.filter(
                ([k]) =>
                  !/^(Admission number|Reference number|Registration number|Batch|Course \/ specialization)$/.test(
                    k,
                  ),
              ),
            }
          : s,
      ),
      signatures: [
        "Student",
        "Parent / guardian",
        "Admission officer",
        "Principal",
      ],
    });
  }
  function exportCsv() {
    csv(
      `admission-${admissionNumber}`,
      sections().flatMap((s) =>
        s.fields
          ? s.fields.map(([field, value]) => ({
              Section: s.title,
              Field: field,
              Value: value,
            }))
          : (s.rows || []).map((r) => ({
              Section: s.title,
              Field: r[0],
              Value: r.slice(1).filter(Boolean).join(" | "),
            })),
      ),
    );
  }

  const reviewSections = sections().map((s) =>
    s.title === "Admission"
      ? {
          ...s,
          title: "Course & facilities",
          fields: s.fields!.filter(
            ([k]) =>
              !/^(Admission number|Reference number|Registration number|Batch|Course \/ specialization)$/.test(
                k,
              ),
          ),
        }
      : s,
  );
  const review = (
    <div className="enw-review enw-print">
      <header className="enw-review-head">
        <div className="enw-review-photo">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Student" />
          ) : (
            <UserRound size={40} />
          )}
        </div>
        <div className="enw-review-title">
          <span className="enw-eyebrow">
            {college.name} · Student admission form
          </span>
          <h2>{studentName || "New student"}</h2>
          <dl className="enw-numbers">
            {headline().map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>
      <div className="enw-review-columns">
        {reviewSections
          .filter((s) => s.fields)
          .map((s) => (
            <section key={s.title} className="enw-review-card">
              <h4>{s.title}</h4>
              <dl>
                {s.fields!.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
      </div>
      {reviewSections
        .filter((s) => s.rows)
        .map((s) => (
          <section key={s.title} className="enw-review-card enw-review-table">
            <h4>{s.title}</h4>
            <table>
              <thead>
                <tr>
                  {s.columns?.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rows!.map((r, i) => (
                  <tr
                    key={i}
                    className={
                      /^(Gross fee|Net payable)$/.test(r[0]) ? "enw-total" : ""
                    }
                  >
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      <div className="enw-signatures" aria-hidden="true">
        {["Student", "Parent / guardian", "Admission officer", "Principal"].map(
          (who) => (
            <span key={who}>{who}</span>
          ),
        )}
      </div>
    </div>
  );
  const exports = (
    <div className="enw-exports">
      <button type="button" onClick={() => window.print()}>
        <Printer size={15} /> Print
      </button>
      <button type="button" onClick={() => void pdf()}>
        <FileDown size={15} /> PDF
      </button>
      <button type="button" onClick={exportCsv}>
        <FileSpreadsheet size={15} /> CSV
      </button>
    </div>
  );

  return (
    <div
      className="enw-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Student enrollment"
    >
      <div className="enw-shell">
        <header className="enw-top">
          <div>
            <span className="enw-eyebrow">Student enrollment</span>
            <h2>{result ? "Student enrolled" : STEPS[step]}</h2>
          </div>
          <ol className="enw-steps" aria-label="Enrollment steps">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={
                  i === step ? "is-active" : i < step || result ? "is-done" : ""
                }
              >
                <span>{i < step || result ? <Check size={14} /> : i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <button
            className="enw-close"
            onClick={onClose}
            aria-label="Close enrollment"
          >
            <X size={20} />
          </button>
        </header>

        {error && (
          <p className="enw-error" role="alert">
            {error}
          </p>
        )}

        {result ? (
          <div className="enw-body">
            <div className="enw-success">
              <CheckCircle2 size={34} />
              <div>
                <h3>{studentName} is enrolled</h3>
                <p>
                  Admission number <strong>{admissionNumber}</strong> ·
                  Reference number <strong>{referenceNumber}</strong> ·
                  Registration number <strong>{registrationNumber}</strong>
                  {result.profile.fee_summary.some(
                    (f) => f.status === "pending_approval",
                  ) &&
                    " · Scholarship/special consideration recorded; finance will approve it on the ledger."}
                </p>
                {uploadIssues.length > 0 && (
                  <p className="enw-warn">
                    Some files were not uploaded (upload them from the student
                    record): {uploadIssues.join("; ")}
                  </p>
                )}
              </div>
              {exports}
            </div>
            {review}
          </div>
        ) : (
          <div className="enw-viewport">
            <div
              className="enw-track"
              style={{ transform: `translateX(-${step * (100 / 3)}%)` }}
            >
              {/* ---------------- Step 1 ---------------- */}
              <form
                ref={stepOne}
                className="enw-panel"
                aria-hidden={step !== 0}
                inert={step !== 0}
                onSubmit={(e) => e.preventDefault()}
              >
                <PhotoCapture
                  photo={photo}
                  preview={photoUrl}
                  onChange={setPhoto}
                />
                <Card title="Student details" icon={<UserRound size={17} />}>
                  <div className="enw-grid">
                    <Field label="Complete name as per SSC *" wide>
                      <input
                        required
                        maxLength={300}
                        autoComplete="off"
                        value={student.complete_name}
                        onChange={(e) =>
                          setStudent({
                            ...student,
                            complete_name: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Date of birth *">
                      <DateInput
                        required
                        value={student.date_of_birth}
                        onChange={(e) =>
                          setStudent({
                            ...student,
                            date_of_birth: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Gender *">
                      <Select
                        required
                        value={student.gender}
                        onChange={(e) =>
                          setStudent({ ...student, gender: e.target.value })
                        }
                      >
                        <option value="">Select</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">
                          Prefer not to say
                        </option>
                      </Select>
                    </Field>
                    <Field label="Blood group">
                      <Select
                        value={student.blood_group}
                        onChange={(e) =>
                          setStudent({
                            ...student,
                            blood_group: e.target.value,
                          })
                        }
                      >
                        <option value="">Select</option>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                          (g) => (
                            <option key={g}>{g}</option>
                          ),
                        )}
                      </Select>
                    </Field>
                    <Field label="Contact number *">
                      <PhoneInput
                        label="Contact number"
                        required
                        code={codes.student}
                        onCode={(student) => setCodes({ ...codes, student })}
                        value={student.phone}
                        onChange={(phone) => setStudent({ ...student, phone })}
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        type="email"
                        value={student.email}
                        onChange={(e) =>
                          setStudent({ ...student, email: e.target.value })
                        }
                      />
                    </Field>
                    {options && options.campuses.length > 1 && (
                      <Field label="Campus *">
                        <Select
                          required
                          value={student.campus_code}
                          onChange={(e) =>
                            setStudent({
                              ...student,
                              campus_code: e.target.value,
                            })
                          }
                        >
                          <option value="">Select</option>
                          {options.campuses.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}
                    <Field label="Address *" wide>
                      <input
                        required
                        value={student.address}
                        onChange={(e) =>
                          setStudent({ ...student, address: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="City *">
                      <input
                        required
                        value={student.city}
                        onChange={(e) =>
                          setStudent({ ...student, city: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="State *">
                      <input
                        required
                        value={student.state}
                        onChange={(e) =>
                          setStudent({ ...student, state: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="PIN code *">
                      <input
                        required
                        pattern="[0-9]{6}"
                        value={student.postal_code}
                        onChange={(e) =>
                          setStudent({
                            ...student,
                            postal_code: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                </Card>

                <Card title="Identity" icon={<IdCard size={17} />}>
                  <div className="enw-grid">
                    <Field
                      label="Student Aadhaar number *"
                      hint="12 digits, and upload the Aadhaar copy (PDF, JPG or PNG up to 650 KB)."
                    >
                      <IdWithUpload
                        required
                        inputMode="numeric"
                        pattern="[0-9]{12}"
                        maxLength={12}
                        title="Aadhaar number must be exactly 12 digits"
                        placeholder="Enter Aadhaar number"
                        value={student.aadhaar_number}
                        onValue={(v) =>
                          setStudent({
                            ...student,
                            aadhaar_number: v.replace(/\D/g, "").slice(0, 12),
                          })
                        }
                        fileLabel="Aadhaar copy"
                        fileRequired
                        file={files.aadhaar_copy}
                        onFile={(f) => setFiles({ ...files, aadhaar_copy: f })}
                      />
                    </Field>
                    <Field label="DIGI LOCKER or APAR ID">
                      <input
                        maxLength={50}
                        autoComplete="off"
                        value={identity.apar_id}
                        onChange={(e) =>
                          setIdentity({ ...identity, apar_id: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Sachivalayam code">
                      <input
                        maxLength={50}
                        autoComplete="off"
                        value={identity.sachivalayam_code}
                        onChange={(e) =>
                          setIdentity({
                            ...identity,
                            sachivalayam_code: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Sachivalayam name">
                      <input
                        maxLength={150}
                        autoComplete="off"
                        value={identity.sachivalayam_name}
                        onChange={(e) =>
                          setIdentity({
                            ...identity,
                            sachivalayam_name: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                </Card>

                <Card
                  title="Qualifications"
                  icon={<GraduationCap size={17} />}
                  aside={
                    <button
                      type="button"
                      disabled={qualifications.length >= 10}
                      onClick={() => {
                        qualificationId.current += 1;
                        const used = qualifications.map((q) => q.level);
                        const level = used.includes("ssc")
                          ? used.includes("intermediate")
                            ? "polytechnic"
                            : "intermediate"
                          : "ssc";
                        setQualifications([
                          ...qualifications,
                          newQualification(qualificationId.current, level),
                        ]);
                      }}
                    >
                      <Plus size={14} /> Add qualification
                    </button>
                  }
                >
                  {qualifications.map((q, index) => (
                    <div key={q.id} className="enw-qualification">
                      <div className="enw-qualification-head">
                        <div
                          className="enw-segmented"
                          role="radiogroup"
                          aria-label={`Qualification ${index + 1} type`}
                        >
                          {QUALIFICATION_LEVELS.map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={q.level === value}
                              className={q.level === value ? "is-on" : ""}
                              onClick={() =>
                                updateQualification(q.id, {
                                  level: value,
                                  group:
                                    value === "intermediate"
                                      ? GROUPS.includes(q.group)
                                        ? q.group
                                        : "MPC"
                                      : "",
                                })
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {qualifications.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remove qualification ${index + 1}`}
                            onClick={() =>
                              setQualifications(
                                qualifications.filter((x) => x.id !== q.id),
                              )
                            }
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                      </div>
                      <div className="enw-grid">
                        <Field
                          label={
                            q.level === "ssc"
                              ? "School name *"
                              : "College name *"
                          }
                          wide
                        >
                          <input
                            required
                            value={q.institution}
                            onChange={(e) =>
                              updateQualification(q.id, {
                                institution: e.target.value,
                              })
                            }
                          />
                        </Field>
                        {q.level === "ssc" && (
                          <>
                            <Field label="Board *">
                              <Select
                                value={q.board}
                                onChange={(e) =>
                                  updateQualification(q.id, {
                                    board: e.target.value,
                                  })
                                }
                              >
                                {BOARDS.map((b) => (
                                  <option key={b}>{b}</option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Grade / GPA *">
                              <input
                                required
                                value={q.grade}
                                onChange={(e) =>
                                  updateQualification(q.id, {
                                    grade: e.target.value,
                                  })
                                }
                              />
                            </Field>
                          </>
                        )}
                        {q.level === "intermediate" && (
                          <>
                            <Field label="Group *">
                              <Select
                                value={q.group}
                                onChange={(e) =>
                                  updateQualification(q.id, {
                                    group: e.target.value,
                                  })
                                }
                              >
                                {GROUPS.map((g) => (
                                  <option key={g}>{g}</option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="1st year % / grade *">
                              <input
                                required
                                value={q.first_year_score}
                                onChange={(e) =>
                                  updateQualification(q.id, {
                                    first_year_score: e.target.value,
                                  })
                                }
                              />
                            </Field>
                            <Field label="2nd year % / grade *">
                              <input
                                required
                                value={q.second_year_score}
                                onChange={(e) =>
                                  updateQualification(q.id, {
                                    second_year_score: e.target.value,
                                  })
                                }
                              />
                            </Field>
                          </>
                        )}
                        {HAS_SEMESTERS.has(q.level) && (
                          <Field
                            label={COURSE_LABEL[q.level]}
                            hint={COURSE_HINT[q.level]}
                          >
                            <input
                              required={COURSE_LABEL[q.level].endsWith("*")}
                              maxLength={30}
                              value={q.group}
                              onChange={(e) =>
                                updateQualification(q.id, {
                                  group: e.target.value,
                                })
                              }
                            />
                          </Field>
                        )}
                        {q.level !== "ssc" && (
                          <Field label="Total percentage">
                            <input
                              maxLength={20}
                              value={q.total_percentage}
                              onChange={(e) =>
                                updateQualification(q.id, {
                                  total_percentage: e.target.value,
                                })
                              }
                            />
                          </Field>
                        )}
                        <Field label="Year passed">
                          <input
                            type="number"
                            min={1990}
                            max={2100}
                            value={q.passed_year}
                            onChange={(e) =>
                              updateQualification(q.id, {
                                passed_year: e.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                      {HAS_SEMESTERS.has(q.level) && (
                        <div className="enw-semesters">
                          <div className="enw-grid enw-grid-3">
                            {q.semesters.map((row, i) => (
                              <Field key={i} label={`${row.semester} %`}>
                                <span className="enw-semester-input">
                                  <input
                                    maxLength={20}
                                    value={row.score}
                                    onChange={(e) =>
                                      updateQualification(q.id, {
                                        semesters: q.semesters.map((x, j) =>
                                          j === i
                                            ? { ...x, score: e.target.value }
                                            : x,
                                        ),
                                      })
                                    }
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Remove ${row.semester}`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      updateQualification(q.id, {
                                        semesters: q.semesters
                                          .filter((_, j) => j !== i)
                                          .map((x, j) => ({
                                            ...x,
                                            semester: `Semester ${j + 1}`,
                                          })),
                                      });
                                    }}
                                  >
                                    <X size={13} />
                                  </button>
                                </span>
                              </Field>
                            ))}
                          </div>
                          <button
                            type="button"
                            disabled={q.semesters.length >= 16}
                            onClick={() =>
                              updateQualification(q.id, {
                                semesters: [
                                  ...q.semesters,
                                  {
                                    semester: `Semester ${q.semesters.length + 1}`,
                                    score: "",
                                  },
                                ],
                              })
                            }
                          >
                            <Plus size={14} /> Add semester
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </Card>

                <Card title="Bank account details" icon={<IdCard size={17} />}>
                  {BANK_OWNERS.map(([owner, label]) => {
                    const bank = banks[owner];
                    const required = bankStarted(owner);
                    const change = (patch: Partial<BankForm>) =>
                      setBanks({ ...banks, [owner]: { ...bank, ...patch } });
                    return (
                      <div key={owner} className="enw-bank">
                        <h4>{label} bank account</h4>
                        <div className="enw-grid">
                          <Field label={`Account holder name${required ? " *" : ""}`}>
                            <input
                              required={required}
                              minLength={2}
                              maxLength={150}
                              autoComplete="off"
                              value={bank.account_holder}
                              onChange={(e) =>
                                change({ account_holder: e.target.value })
                              }
                            />
                          </Field>
                          <Field label={`Account number${required ? " *" : ""}`}>
                            <input
                              required={required}
                              inputMode="numeric"
                              pattern="[0-9]{6,34}"
                              title="6 to 34 digits"
                              maxLength={34}
                              autoComplete="off"
                              value={bank.account_number}
                              onChange={(e) =>
                                change({
                                  account_number: e.target.value.replace(/\D/g, ""),
                                })
                              }
                            />
                          </Field>
                          <Field label={`Bank name${required ? " *" : ""}`}>
                            <input
                              required={required}
                              minLength={2}
                              maxLength={150}
                              autoComplete="off"
                              value={bank.bank_name}
                              onChange={(e) =>
                                change({ bank_name: e.target.value })
                              }
                            />
                          </Field>
                          <Field label={`IFSC code${required ? " *" : ""}`}>
                            <input
                              required={required}
                              pattern="[A-Z]{4}0[A-Z0-9]{6}"
                              title="11 characters, for example SBIN0001234"
                              maxLength={11}
                              autoComplete="off"
                              spellCheck={false}
                              placeholder="e.g. SBIN0001234"
                              value={bank.ifsc}
                              onChange={(e) =>
                                change({ ifsc: e.target.value.toUpperCase() })
                              }
                            />
                          </Field>
                          <Field label="Branch">
                            <input
                              maxLength={150}
                              autoComplete="off"
                              value={bank.branch}
                              onChange={(e) => change({ branch: e.target.value })}
                            />
                          </Field>
                          <Field
                            label="Bank passbook first page"
                            hint="JPG or PNG image up to 650 KB."
                          >
                            <FilePick
                              label="Upload image"
                              accept=".png,.jpg,.jpeg"
                              file={files[`bank_passbook_${owner}`]}
                              onChange={(f) =>
                                setFiles({
                                  ...files,
                                  [`bank_passbook_${owner}`]: f,
                                })
                              }
                            />
                          </Field>
                        </div>
                      </div>
                    );
                  })}
                </Card>

                <Card title="Documents submitted" icon={<Upload size={17} />}>
                  <p className="enw-muted">
                    Tick what the student has submitted. Files can be uploaded
                    now or later from the student record.
                  </p>
                  <div className="enw-docs">
                    {documentList.map((d) => (
                      <div
                        key={d.key}
                        className={
                          documents[d.key] ? "enw-doc is-on" : "enw-doc"
                        }
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={!!documents[d.key]}
                            onChange={(e) =>
                              setDocuments({
                                ...documents,
                                [d.key]: e.target.checked,
                              })
                            }
                          />
                          {d.label}
                        </label>
                        {documents[d.key] && (
                          <FilePick
                            label="Upload (optional)"
                            file={files[d.key]}
                            onChange={(f) => setFiles({ ...files, [d.key]: f })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Family details" icon={<UserRound size={17} />}>
                  <div className="enw-grid">
                    <Field
                      label={`Father name as per SSC${family.has_other ? "" : " *"}`}
                    >
                      <input
                        required={!family.has_other}
                        maxLength={200}
                        autoComplete="off"
                        value={family.father_name}
                        onChange={(e) =>
                          setFamily({ ...family, father_name: e.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label={`Mother name as per SSC${family.has_other ? "" : " *"}`}
                    >
                      <input
                        required={!family.has_other}
                        maxLength={200}
                        autoComplete="off"
                        value={family.mother_name}
                        onChange={(e) =>
                          setFamily({ ...family, mother_name: e.target.value })
                        }
                      />
                    </Field>
                    <label className="enw-switch enw-wide">
                      <input
                        type="checkbox"
                        checked={family.has_other}
                        onChange={(e) =>
                          setFamily({ ...family, has_other: e.target.checked })
                        }
                      />{" "}
                      Other (guardian)
                    </label>
                    {family.has_other && (
                      <>
                        <Field label="Guardian name as per SSC *">
                          <input
                            required
                            maxLength={200}
                            autoComplete="off"
                            value={family.guardian_name}
                            onChange={(e) =>
                              setFamily({
                                ...family,
                                guardian_name: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="Guardian relation *">
                          <input
                            required
                            maxLength={100}
                            autoComplete="off"
                            placeholder="e.g. Uncle, grandmother…"
                            value={family.guardian_relationship}
                            onChange={(e) =>
                              setFamily({
                                ...family,
                                guardian_relationship: e.target.value,
                              })
                            }
                          />
                        </Field>
                      </>
                    )}
                    <Field label="Primary contact number *">
                      <PhoneInput
                        label="Primary contact number"
                        required
                        code={codes.phone}
                        onCode={(phone) => setCodes({ ...codes, phone })}
                        value={family.primary_phone}
                        onChange={(primary_phone) =>
                          setFamily({ ...family, primary_phone })
                        }
                      />
                    </Field>
                    <Field label="Secondary contact number">
                      <PhoneInput
                        label="Secondary contact number"
                        code={codes.alternate}
                        onCode={(alternate) =>
                          setCodes({ ...codes, alternate })
                        }
                        value={family.secondary_phone}
                        onChange={(secondary_phone) =>
                          setFamily({ ...family, secondary_phone })
                        }
                      />
                    </Field>
                  </div>
                </Card>

                <Card
                  title="Referral"
                  asideInline
                  aside={
                    <label className="enw-switch">
                      <input
                        type="checkbox"
                        checked={referred}
                        onChange={(e) => setReferred(e.target.checked)}
                      />{" "}
                      Joined through a referral
                    </label>
                  }
                >
                  {referred ? (
                    <div className="enw-grid">
                      <Field label="Referral name *">
                        <input
                          required
                          value={referral.name}
                          onChange={(e) =>
                            setReferral({ ...referral, name: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Relation to the organization *"
                        hint="Staff, alumni, student, agent, ..."
                      >
                        <input
                          required
                          value={referral.relation}
                          onChange={(e) =>
                            setReferral({
                              ...referral,
                              relation: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Referral mobile number *">
                        <PhoneInput
                          label="Referral mobile number"
                          required
                          code={codes.referral}
                          onCode={(referral) =>
                            setCodes({ ...codes, referral })
                          }
                          value={referral.mobile}
                          onChange={(mobile) =>
                            setReferral({ ...referral, mobile })
                          }
                        />
                      </Field>
                    </div>
                  ) : (
                    <p className="enw-muted">No referral.</p>
                  )}
                </Card>

                <Card
                  title="Academic achievements (optional)"
                  aside={
                    <button
                      type="button"
                      onClick={() =>
                        setAchievements([
                          ...achievements,
                          { title: "", level: "", year: "", description: "" },
                        ])
                      }
                    >
                      <Plus size={14} /> Add achievement
                    </button>
                  }
                >
                  {achievements.length === 0 && (
                    <p className="enw-muted">None added.</p>
                  )}
                  {achievements.map((a, i) => (
                    <div key={i} className="enw-row">
                      <input
                        aria-label="Achievement"
                        placeholder="Achievement (e.g. State rank in science olympiad)"
                        value={a.title}
                        onChange={(e) =>
                          setAchievements(
                            achievements.map((x, j) =>
                              j === i ? { ...x, title: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <Select
                        aria-label="Level"
                        value={a.level}
                        onChange={(e) =>
                          setAchievements(
                            achievements.map((x, j) =>
                              j === i ? { ...x, level: e.target.value } : x,
                            ),
                          )
                        }
                      >
                        <option value="">Level</option>
                        {[
                          "School",
                          "District",
                          "State",
                          "National",
                          "International",
                        ].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </Select>
                      <input
                        aria-label="Year"
                        placeholder="Year"
                        type="number"
                        value={a.year}
                        onChange={(e) =>
                          setAchievements(
                            achievements.map((x, j) =>
                              j === i ? { ...x, year: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
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
                  ))}
                </Card>

                <Card
                  title="Certifications — NCC, NSS, sports, … (optional)"
                  aside={
                    <button
                      type="button"
                      onClick={() =>
                        setCertificates([
                          ...certificates,
                          { name: "", issuer: "", year: "" },
                        ])
                      }
                    >
                      <Plus size={14} /> Add certificate
                    </button>
                  }
                >
                  {certificates.length === 0 && (
                    <p className="enw-muted">None added.</p>
                  )}
                  {certificates.map((c, i) => (
                    <div key={i} className="enw-row">
                      <input
                        aria-label="Certificate"
                        placeholder="Certificate (e.g. NCC 'A' certificate)"
                        value={c.name}
                        onChange={(e) =>
                          setCertificates(
                            certificates.map((x, j) =>
                              j === i ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label="Issued by"
                        placeholder="Issued by"
                        value={c.issuer}
                        onChange={(e) =>
                          setCertificates(
                            certificates.map((x, j) =>
                              j === i ? { ...x, issuer: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label="Year"
                        placeholder="Year"
                        type="number"
                        value={c.year}
                        onChange={(e) =>
                          setCertificates(
                            certificates.map((x, j) =>
                              j === i ? { ...x, year: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        aria-label="Remove certificate"
                        onClick={() =>
                          setCertificates(
                            certificates.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </Card>
              </form>

              {/* ---------------- Step 2 ---------------- */}
              <form
                ref={stepTwo}
                className="enw-panel"
                aria-hidden={step !== 1}
                inert={step !== 1}
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="enw-numbers-bar">
                  <Field label="Admission number *">
                    <input
                      required
                      maxLength={40}
                      pattern="[A-Za-z0-9][A-Za-z0-9/_\-]*"
                      title="Letters, numbers, / _ and - only"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Enter admission number"
                      value={admissionInput}
                      onChange={(e) => setAdmissionInput(e.target.value)}
                    />
                  </Field>
                  <div>
                    <span>Reference number</span>
                    <strong>
                      {quote?.admission_number || "Choose a course and year"}
                    </strong>
                  </div>
                  <div>
                    <span>Registration number</span>
                    <strong>
                      {course.program_code
                        ? quote?.registration_number || "—"
                        : "Choose a course"}
                    </strong>
                  </div>
                  <small>
                    Reference number: year + INT/DEG + branch code + sequence
                    (e.g. 26INTMPC0001). Assigned when enrollment is confirmed.
                  </small>
                </div>
                <Card
                  title="Course selection"
                  icon={<GraduationCap size={17} />}
                >
                  <div
                    className="enw-segmented"
                    role="radiogroup"
                    aria-label="Joining"
                  >
                    {COURSE_LEVELS.filter(
                      (l) =>
                        l.key === "intermediate" ||
                        l.key === "degree" ||
                        (options?.courses[l.key]?.length || 0) > 0,
                    ).map(({ key: value, label }) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={course.level === value}
                        className={course.level === value ? "is-on" : ""}
                        onClick={() => {
                          setQuote(null);
                          setCourse({
                            ...course,
                            level: value as CourseLevel,
                            program_code: "",
                            academic_year_code: "",
                          });
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="enw-label">
                    {course.level === "intermediate"
                      ? "Group / specialization"
                      : "Degree and branch"}
                  </p>
                  {programs.length === 0 ? (
                    <p className="enw-warn">
                      No {course.level} courses yet. Create them in Courses
                      &amp; enrollment (set the level and branch).
                    </p>
                  ) : (
                    <>
                      {course.level === "degree" && (
                        <div className="enw-course-filter">
                          <SearchField
                            aria-label="Search degree courses"
                            placeholder="Search courses, e.g. B.Com, Data Science"
                            value={courseQuery}
                            onValueChange={setCourseQuery}
                            suggestions={searchValues(programs, [
                              "name",
                              "branch",
                              "qualification",
                            ])}
                          />
                          <div
                            className="enw-chips"
                            role="group"
                            aria-label="Course family"
                          >
                            {["All", ...families].map((f) => (
                              <button
                                key={f}
                                type="button"
                                className={
                                  (courseFamily || "All") === f ? "is-on" : ""
                                }
                                aria-pressed={(courseFamily || "All") === f}
                                onClick={() =>
                                  setCourseFamily(f === "All" ? "" : f)
                                }
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="enw-choices">
                        {visiblePrograms.length === 0 && (
                          <p className="enw-muted">No course matches.</p>
                        )}
                        {visiblePrograms.map((p) => (
                          <button
                            key={p.code}
                            type="button"
                            className={
                              p.code === course.program_code
                                ? "enw-choice is-on"
                                : "enw-choice"
                            }
                            onClick={() => {
                              const matching = (
                                options?.academic_years || []
                              ).filter((y) => y.program_code === p.code);
                              setQuote(null);
                              setCourse({
                                ...course,
                                program_code: p.code,
                                academic_year_code: matching.some(
                                  (y) => y.code === course.academic_year_code,
                                )
                                  ? course.academic_year_code
                                  : "",
                              });
                            }}
                            aria-pressed={p.code === course.program_code}
                          >
                            <strong>{p.branch || p.name}</strong>
                            <small>{p.branch ? p.name : p.qualification}</small>
                            <em>
                              {p.duration_label ||
                                `${p.duration_years || Number(p.duration_semesters || 0) / 2} years`}
                              {p.duration_semesters
                                ? ` · ${p.duration_semesters} semesters`
                                : ""}
                            </em>
                            {!!p.subjects && <em>{p.subjects}</em>}
                            {!!p.semester_labels?.length && (
                              <em>{p.semester_labels.join(" · ")}</em>
                            )}
                            {!!p.details && <em>{p.details}</em>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="enw-academic-year-actions">
                    <Field label="Batch *">
                      <Select
                        required
                        disabled={!course.program_code}
                        value={course.academic_year_code}
                        onChange={(e) =>
                          setCourse({
                            ...course,
                            academic_year_code: e.target.value,
                          })
                        }
                      >
                        <option value="">
                          {course.program_code
                            ? "Select a batch"
                            : "Choose a course first"}
                        </option>
                        {academicYears.map((y) => (
                          <option key={y.code} value={y.code}>
                            {y.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <button
                      type="button"
                      className="enw-manage-years"
                      onClick={() => setAcademicYearFormOpen(true)}
                    >
                      <Plus size={14} aria-hidden="true" />
                      Create batch
                    </button>
                  </div>
                </Card>

                <Card title="Facilities">
                  <div className="enw-facilities">
                    <label
                      className={hostel ? "enw-facility is-on" : "enw-facility"}
                    >
                      <input
                        type="checkbox"
                        checked={hostel}
                        onChange={(e) => setHostel(e.target.checked)}
                      />
                      <BedDouble size={20} />
                      <span>
                        <strong>Hostel</strong>
                        <small>
                          {hostelFee
                            ? inr(hostelFee) +
                              (fullCourseFees ? " full course" : " per year")
                            : "No hostel fee set for this course"}
                        </small>
                      </span>
                    </label>
                    <label
                      className={
                        transport ? "enw-facility is-on" : "enw-facility"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={transport}
                        onChange={(e) => setTransport(e.target.checked)}
                      />
                      <Bus size={20} />
                      <span>
                        <strong>College bus</strong>
                        <small>
                          {busFee
                            ? inr(busFee) +
                              (fullCourseFees ? " full course" : " per year")
                            : "No bus fee set for this course"}
                        </small>
                      </span>
                    </label>
                  </div>
                </Card>

                <Card
                  title={
                    fullCourseFees
                      ? `Full course fee · ${Math.ceil(termCount / 2)} years · ${termCount} semesters`
                      : "Fee structure (first year)"
                  }
                >
                  {!course.program_code ? (
                    <p className="enw-muted">
                      Choose a course to see its fee structure.
                    </p>
                  ) : fees.length === 0 ? (
                    <p className="enw-warn">
                      No fee structure for this course and year yet. The Master
                      Data Entry user adds it in Fee structures.
                    </p>
                  ) : (
                    <table className="enw-fees">
                      <tbody>
                        {fees.map((f) => (
                          <tr key={f.fee_structure_code}>
                            <td>
                              {f.name}
                              <small>
                                {f.category === "academic" ? "" : f.category}
                              </small>
                            </td>
                            <td>
                              {f.fee_basis === "full_course"
                                ? "Full course"
                                : f.due_date}
                            </td>
                            <td>{inr(num(f.amount))}</td>
                          </tr>
                        ))}
                        <tr className="enw-total">
                          <td>Gross fee</td>
                          <td />
                          <td>{inr(gross)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                  <div className="enw-grid enw-concessions">
                    <Field
                      label="Student scholarship (optional)"
                      hint="Deducted from the fee"
                    >
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={scholarship.amount}
                        onChange={(e) =>
                          setScholarship({
                            ...scholarship,
                            amount: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Scholarship name / sponsor">
                      <input
                        value={scholarship.name}
                        onChange={(e) =>
                          setScholarship({
                            ...scholarship,
                            name: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Special consideration (optional)"
                      hint="Discount for this student"
                    >
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={special.amount}
                        onChange={(e) =>
                          setSpecial({ ...special, amount: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={`Reason${num(special.amount) ? " *" : ""}`}>
                      <input
                        required={!!num(special.amount)}
                        value={special.reason}
                        onChange={(e) =>
                          setSpecial({ ...special, reason: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <div className="enw-net">
                    <span>Net payable</span>
                    <strong>{inr(net)}</strong>
                    {concession > 0 && (
                      <small>after {inr(concession)} concession</small>
                    )}
                  </div>
                </Card>

                <Card title="Student summary">
                  <div className="enw-summary">
                    <div className="enw-review-photo">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrl} alt="Student" />
                      ) : (
                        <UserRound size={34} />
                      )}
                    </div>
                    <dl>
                      <div>
                        <dt>Student</dt>
                        <dd>{studentName || "—"}</dd>
                      </div>
                      <div>
                        <dt>Contact</dt>
                        <dd>{withCode(codes.student, student.phone) || "—"}</dd>
                      </div>
                      <div>
                        <dt>Last qualification</dt>
                        <dd>
                          {latestQualification
                            ? [
                                qualificationName(latestQualification),
                                qualificationScore(latestQualification),
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Guardian (primary contact)</dt>
                        <dd>
                          {contactName
                            ? `${contactName} (${contactRelationship})`
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </Card>
              </form>

              {/* ---------------- Step 3 ---------------- */}
              <div
                className="enw-panel"
                aria-hidden={step !== 2}
                inert={step !== 2}
              >
                <div className="enw-confirm-bar">
                  <p>
                    Check every detail with the student and parent. Confirming
                    reserves the reference and registration numbers and raises
                    {fullCourseFees
                      ? "the full-course fee, payable by semester."
                      : "the first-year fee."}
                  </p>
                  {exports}
                </div>
                {review}
              </div>
            </div>
          </div>
        )}

        <footer className="enw-footer">
          {result ? (
            <button className="enw-primary" onClick={onClose}>
              Done
            </button>
          ) : (
            <>
              <button
                onClick={step === 0 ? onClose : () => setStep(step - 1)}
                disabled={busy}
              >
                {step === 0 ? (
                  "Cancel"
                ) : (
                  <>
                    <ArrowLeft size={15} /> Back
                  </>
                )}
              </button>
              {step < 2 ? (
                <button
                  className="enw-primary"
                  onClick={next}
                  disabled={!options}
                >
                  {step === 0 ? "Next: course & fees" : "Next: review"}{" "}
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  className="enw-primary"
                  onClick={() => void confirm()}
                  disabled={busy}
                >
                  {busy ? "Enrolling…" : "Confirm enrollment"}{" "}
                  <Check size={15} />
                </button>
              )}
            </>
          )}
        </footer>
      </div>
      {academicYearFormOpen && (
        <AcademicYearForm
          title="Create batch"
          initial={{ program_code: course.program_code }}
          onClose={() => setAcademicYearFormOpen(false)}
          onSave={async (values) => {
            const saved = await api.workspace.create("academic_years", {
              values,
            });
            const createdYear = {
              code: String(saved.code || values.code),
              name: String(saved.name || values.name),
              program_code: String(values.program_code),
              batch_code: saved.batch_code
                ? String(saved.batch_code)
                : undefined,
              start_date: String(values.start_date),
              end_date: String(values.end_date),
            };
            // Keep the saved year available even if refreshing options fails.
            setOptions((current) =>
              current
                ? {
                    ...current,
                    academic_years: [
                      ...current.academic_years.filter(
                        (year) => year.code !== createdYear.code,
                      ),
                      createdYear,
                    ],
                  }
                : current,
            );
            setQuote(null);
            setCourse((current) => ({
              ...current,
              level: options?.courses.degree.some(
                (entry) => entry.code === createdYear.program_code,
              )
                ? "degree"
                : "intermediate",
              program_code: createdYear.program_code,
              academic_year_code: createdYear.code,
            }));
            toast.success("Batch created", createdYear.name);
            try {
              setOptions(await api.masterData.enrollmentOptions());
            } catch {
              toast.error(
                "Batch saved",
                "Could not refresh all course options. The saved year is selected; reopen enrollment to refresh the remaining options.",
              );
            }
          }}
        />
      )}
    </div>
  );
}
