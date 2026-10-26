"use client";
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
import { csv, professionalPdf } from "@/lib/colleges/download";
import "./enrollment-wizard.css";
import { toast } from "../toast";
import Select from "../SearchSelect";
import { PhoneInput } from "../CountryCodePicker";
import { UploadButton } from "../UploadBox";
import DateInput, { formatDate } from "../DateInput";

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
const fullName = (p: {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
}) => [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");

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
}: {
  college: College;
  onClose: () => void;
  onEnrolled?: (studentCode: string) => void;
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
    first_name: "",
    middle_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    email: "",
    phone: "",
    aadhaar_number: "",
    blood_group: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
    campus_code: "",
  });
  const [qualification, setQualification] = useState({
    level: "ssc" as "ssc" | "intermediate",
    institution: "",
    board: BOARDS[0],
    group: "MPC",
    grade: "",
    first_year_score: "",
    second_year_score: "",
    passed_year: "",
  });
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
  const [guardian, setGuardian] = useState<Guardian>({
    relationship: "father",
    first_name: "",
    last_name: "",
    phone: "",
    alternate_phone: "",
  });
  const [referred, setReferred] = useState(false);
  const [referral, setReferral] = useState({
    name: "",
    relation: "",
    mobile: "",
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [course, setCourse] = useState({
    level: "intermediate" as CourseLevel,
    program_code: "",
    academic_year_code: "",
  });
  const [courseQuery, setCourseQuery] = useState("");
  const [courseFamily, setCourseFamily] = useState("");
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
        setCourse((c) => ({
          ...c,
          academic_year_code:
            c.academic_year_code || value.academic_years[0]?.code || "",
        }));
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
  const year = options?.academic_years.find(
    (y) => y.code === course.academic_year_code,
  );
  const startYear = Number(year?.start_date.slice(0, 4));
  const batch = program?.batches.find((b) => b.entry_year === startYear);
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
        first_name: s.first_name.trim(),
        middle_name: s.middle_name.trim() || undefined,
        last_name: s.last_name.trim(),
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
      last_qualification:
        qualification.level === "ssc"
          ? {
              level: "ssc",
              institution: qualification.institution.trim(),
              board: qualification.board,
              grade: qualification.grade.trim() || undefined,
              passed_year: num(qualification.passed_year) || undefined,
            }
          : {
              level: "intermediate",
              institution: qualification.institution.trim(),
              group: qualification.group,
              first_year_score:
                qualification.first_year_score.trim() || undefined,
              second_year_score:
                qualification.second_year_score.trim() || undefined,
              passed_year: num(qualification.passed_year) || undefined,
            },
      guardian: {
        relationship: guardian.relationship,
        first_name: guardian.first_name.trim(),
        last_name: guardian.last_name.trim(),
        phone: withCode(codes.phone, guardian.phone),
        alternate_phone:
          withCode(codes.alternate, guardian.alternate_phone) || undefined,
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
      if (!batch)
        return warn(
          `The ${startYear} batch of ${program.name} does not exist yet; create it in Courses & enrollment.`,
        );
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
            !!e[1] && (e[0] === "aadhaar_copy" || documents[e[0]]),
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
    result?.student.admission_number || quote?.admission_number || "—",
  );
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
        ["Registration number", registrationNumber],
        ["Academic year", year?.name || "—"],
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
        ["Batch", batch?.name || "—"],
        ["Hostel", hostel ? "Required" : "Not required"],
        ["College bus", transport ? "Required" : "Not required"],
      ],
    },
    {
      title: "Student",
      fields: [
        ["Name", fullName(student)],
        ["Date of birth", formatDate(student.date_of_birth)],
        ["Gender", student.gender.replaceAll("_", " ")],
        ["Contact number", withCode(codes.student, student.phone)],
        ["Email", student.email || "—"],
        [
          "Aadhaar number",
          student.aadhaar_number.replace(/(\d{4})(?=\d)/g, "$1 "),
        ],
        ["Blood group", student.blood_group || "—"],
        [
          "Address",
          [student.address, student.city, student.state, student.postal_code]
            .filter(Boolean)
            .join(", "),
        ],
      ],
    },
    {
      title: "Last qualification",
      fields:
        qualification.level === "ssc"
          ? [
              ["Qualification", "10th class"],
              ["School", qualification.institution],
              ["Board", qualification.board],
              ["Grade / GPA", qualification.grade || "—"],
              ["Year passed", qualification.passed_year || "—"],
            ]
          : [
              ["Qualification", "Intermediate"],
              ["College", qualification.institution],
              ["Group", qualification.group],
              ["1st year % / grade", qualification.first_year_score || "—"],
              ["2nd year % / grade", qualification.second_year_score || "—"],
              ["Year passed", qualification.passed_year || "—"],
            ],
    },
    {
      title: "Guardian details",
      fields: [
        ["Name", `${guardian.first_name} ${guardian.last_name}`.trim()],
        ["Relationship", guardian.relationship],
        [
          "Mobile number (primary contact)",
          withCode(codes.phone, guardian.phone),
        ],
        [
          "Secondary number",
          withCode(codes.alternate, guardian.alternate_phone) || "—",
        ],
      ],
    },
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
  async function pdf() {
    const image = photo ? await dataUrl(photo) : undefined;
    await professionalPdf(`admission-${admissionNumber}`, {
      title: "Student admission — application overview",
      context: { college, reference: admissionNumber },
      sections: sections().map((s, i) =>
        i === 1 && image ? { ...s, image } : s,
      ),
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

  const review = (
    <div className="enw-review enw-print">
      <header className="enw-review-head">
        <div className="enw-review-photo">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Student" />
          ) : (
            <UserRound size={44} />
          )}
        </div>
        <div>
          <span className="enw-eyebrow">{college.name}</span>
          <h2>{fullName(student) || "New student"}</h2>
          <p>
            {program
              ? `${program.name}${program.branch ? ` · ${program.branch}` : ""}`
              : "Course not chosen"}{" "}
            · {year?.name}
          </p>
        </div>
        <dl className="enw-numbers">
          <div>
            <dt>Admission no.</dt>
            <dd>{admissionNumber}</dd>
          </div>
          <div>
            <dt>Registration no.</dt>
            <dd>{registrationNumber}</dd>
          </div>
        </dl>
      </header>
      <div className="enw-review-grid">
        {sections()
          .slice(1)
          .map((s) => (
            <section
              key={s.title}
              className={
                s.rows ? "enw-review-card enw-wide" : "enw-review-card"
              }
            >
              <h4>{s.title}</h4>
              {s.fields && (
                <dl>
                  {s.fields.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {s.rows && (
                <table>
                  <thead>
                    <tr>
                      {s.columns?.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr
                        key={i}
                        className={
                          /^(Gross fee|Net payable)$/.test(r[0])
                            ? "enw-total"
                            : ""
                        }
                      >
                        {r.map((c, j) => (
                          <td key={j}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
        <section className="enw-review-card">
          <h4>Admission</h4>
          <dl>
            {sections()[0].fields!.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
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
                <h3>{fullName(student)} is enrolled</h3>
                <p>
                  Admission number <strong>{admissionNumber}</strong> ·
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
                    <Field label="First name *">
                      <input
                        required
                        value={student.first_name}
                        onChange={(e) =>
                          setStudent({ ...student, first_name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Middle name">
                      <input
                        value={student.middle_name}
                        onChange={(e) =>
                          setStudent({
                            ...student,
                            middle_name: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Last name / surname *">
                      <input
                        required
                        value={student.last_name}
                        onChange={(e) =>
                          setStudent({ ...student, last_name: e.target.value })
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
                  </div>
                </Card>

                <Card
                  title="Last qualification"
                  icon={<GraduationCap size={17} />}
                >
                  <div
                    className="enw-segmented"
                    role="radiogroup"
                    aria-label="Last qualification"
                  >
                    {[
                      ["ssc", "10th class"],
                      ["intermediate", "Intermediate"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={qualification.level === value}
                        className={qualification.level === value ? "is-on" : ""}
                        onClick={() =>
                          setQualification({
                            ...qualification,
                            level: value as "ssc" | "intermediate",
                          })
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="enw-grid">
                    <Field
                      label={
                        qualification.level === "ssc"
                          ? "School name *"
                          : "College name *"
                      }
                      wide
                    >
                      <input
                        required
                        value={qualification.institution}
                        onChange={(e) =>
                          setQualification({
                            ...qualification,
                            institution: e.target.value,
                          })
                        }
                      />
                    </Field>
                    {qualification.level === "ssc" ? (
                      <>
                        <Field label="Board *">
                          <Select
                            value={qualification.board}
                            onChange={(e) =>
                              setQualification({
                                ...qualification,
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
                            value={qualification.grade}
                            onChange={(e) =>
                              setQualification({
                                ...qualification,
                                grade: e.target.value,
                              })
                            }
                          />
                        </Field>
                      </>
                    ) : (
                      <>
                        <Field label="Group *">
                          <Select
                            value={qualification.group}
                            onChange={(e) =>
                              setQualification({
                                ...qualification,
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
                            value={qualification.first_year_score}
                            onChange={(e) =>
                              setQualification({
                                ...qualification,
                                first_year_score: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="2nd year % / grade *">
                          <input
                            required
                            value={qualification.second_year_score}
                            onChange={(e) =>
                              setQualification({
                                ...qualification,
                                second_year_score: e.target.value,
                              })
                            }
                          />
                        </Field>
                      </>
                    )}
                    <Field label="Year passed">
                      <input
                        type="number"
                        min={1990}
                        max={2100}
                        value={qualification.passed_year}
                        onChange={(e) =>
                          setQualification({
                            ...qualification,
                            passed_year: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
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

                <Card title="Guardian details" icon={<UserRound size={17} />}>
                  <div className="enw-grid enw-grid-3">
                    <Field label="Relationship with the student *">
                      <Select
                        required
                        value={guardian.relationship}
                        onChange={(e) =>
                          setGuardian({
                            ...guardian,
                            relationship: e.target
                              .value as Guardian["relationship"],
                          })
                        }
                      >
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="guardian">Guardian</option>
                        <option value="other">Other</option>
                      </Select>
                    </Field>
                    <Field label="Guardian first name *">
                      <input
                        required
                        value={guardian.first_name}
                        onChange={(e) =>
                          setGuardian({
                            ...guardian,
                            first_name: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Guardian last name *">
                      <input
                        required
                        value={guardian.last_name}
                        onChange={(e) =>
                          setGuardian({
                            ...guardian,
                            last_name: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Guardian mobile number *"
                      hint="Primary contact for the student"
                    >
                      <PhoneInput
                        label="Guardian mobile number"
                        required
                        code={codes.phone}
                        onCode={(phone) => setCodes({ ...codes, phone })}
                        value={guardian.phone}
                        onChange={(phone) =>
                          setGuardian({ ...guardian, phone })
                        }
                      />
                    </Field>
                    <Field label="Secondary number">
                      <PhoneInput
                        label="Secondary number"
                        code={codes.alternate}
                        onCode={(alternate) =>
                          setCodes({ ...codes, alternate })
                        }
                        value={guardian.alternate_phone || ""}
                        onChange={(alternate_phone) =>
                          setGuardian({ ...guardian, alternate_phone })
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
                  <div>
                    <span>Admission number</span>
                    <strong>{quote?.admission_number || "—"}</strong>
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
                    Numbers are reserved when the enrollment is confirmed.
                  </small>
                </div>
                <Card
                  title="Course selection"
                  icon={<GraduationCap size={17} />}
                >
                  <div className="enw-grid">
                    <Field label="Academic year *">
                      <Select
                        required
                        value={course.academic_year_code}
                        onChange={(e) =>
                          setCourse({
                            ...course,
                            academic_year_code: e.target.value,
                          })
                        }
                      >
                        {(options?.academic_years || []).map((y) => (
                          <option key={y.code} value={y.code}>
                            {y.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div
                    className="enw-segmented"
                    role="radiogroup"
                    aria-label="Joining"
                  >
                    {[
                      ["intermediate", "Intermediate"],
                      ["degree", "Degree"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={course.level === value}
                        className={course.level === value ? "is-on" : ""}
                        onClick={() =>
                          setCourse({
                            ...course,
                            level: value as CourseLevel,
                            program_code: "",
                          })
                        }
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
                          <input
                            type="search"
                            aria-label="Search degree courses"
                            placeholder="Search courses, e.g. B.Com, Data Science"
                            value={courseQuery}
                            onChange={(e) => setCourseQuery(e.target.value)}
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
                            onClick={() =>
                              setCourse({ ...course, program_code: p.code })
                            }
                            aria-pressed={p.code === course.program_code}
                          >
                            <strong>{p.branch || p.name}</strong>
                            <small>{p.branch ? p.name : p.qualification}</small>
                            {(p.duration_label || p.subjects) && (
                              <em>
                                {course.level === "intermediate"
                                  ? p.subjects
                                  : `${p.duration_label}${p.semesters_label ? ` · ${p.semesters_label} semesters` : ""}`}
                              </em>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {program && (
                    <p className={batch ? "enw-muted" : "enw-warn"}>
                      {batch
                        ? `Batch ${batch.name}`
                        : `No ${startYear} batch for ${program.name} yet — create it in Courses & enrollment.`}
                    </p>
                  )}
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
                        <dd>{fullName(student) || "—"}</dd>
                      </div>
                      <div>
                        <dt>Contact</dt>
                        <dd>{withCode(codes.student, student.phone) || "—"}</dd>
                      </div>
                      <div>
                        <dt>Last qualification</dt>
                        <dd>
                          {qualification.level === "ssc"
                            ? `10th · ${qualification.board} · ${qualification.grade}`
                            : `Intermediate ${qualification.group}`}
                        </dd>
                      </div>
                      <div>
                        <dt>Guardian (primary contact)</dt>
                        <dd>
                          {guardian.first_name
                            ? `${guardian.first_name} ${guardian.last_name} (${guardian.relationship}) · ${withCode(codes.phone, guardian.phone)}`
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
                    reserves the admission and registration numbers and raises
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
    </div>
  );
}
