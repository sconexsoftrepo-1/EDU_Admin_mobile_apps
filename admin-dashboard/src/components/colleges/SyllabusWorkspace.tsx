"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, Download, FileText, Plus, Search } from "lucide-react";
import SideDrawer from "./SideDrawer";
import { useOptionalCollege } from "./CollegeStore";
import { ApiError, errorText } from "@/services/api";
import { syllabus, type SyllabusFile, type SyllabusOptions, type SyllabusPayload, type SyllabusRecord } from "@/services/api/modules/assignments/syllabus";
import { toast } from "./toast";
import WorkspacePrimaryAction from "./WorkspacePrimaryAction";
import "./assignment-workspace.css";
import { readWorkspaceCache, workspaceCacheKey, writeWorkspaceCache } from "@/lib/colleges/workspace-cache";

const allowed = ".pdf,.jpg,.jpeg,.png,.webp";
function AttachmentList({ files, onOpen }: { files: SyllabusFile[]; onOpen: (file: SyllabusFile) => void }) {
  return <div className="as-files">{files.map((file) => <button type="button" key={file.code} onClick={() => onOpen(file)}><FileText size={15}/><span>{file.filename}</span><small>{Math.ceil(file.size_bytes / 1024)} KB</small></button>)}</div>;
}
export default function SyllabusWorkspace({ studentCode }: { studentCode?: string }) {
  const session = useOptionalCollege();
  const role = session?.activeRole;
  const dataKey = workspaceCacheKey(session?.account?.code, role?.code, `special:syllabus:${studentCode || "self"}`);
  const cached = readWorkspaceCache<{ data: SyllabusPayload; options: SyllabusOptions | null }>(dataKey);
  const roleCreate = !!session?.account && !["parent", "student"].includes(session.account.person_type) && !!role && (role.system_admin || role.scope === "teaching" || role.permissions.learning_resources?.includes("create"));
  const [data, setData] = useState<SyllabusPayload | null>(cached?.data || null), [options, setOptions] = useState<SyllabusOptions | null>(cached?.options || null), [error, setError] = useState(""), [busy, setBusy] = useState(!cached), [creating, setCreating] = useState(false), [saving, setSaving] = useState(false), [search, setSearch] = useState(""), [child, setChild] = useState(studentCode || ""), [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState("intermediate"), [courseName, setCourseName] = useState(""), [programCode, setProgramCode] = useState(""), [specialization, setSpecialization] = useState(""), [year, setYear] = useState(""), [name, setName] = useState(""), [description, setDescription] = useState("");
  async function load(selected = child) {
    try { let result = await syllabus.list(selected || undefined); if (!selected && result.role === "parent" && result.students.length) { const first = result.students[0].code; setChild(first); result = await syllabus.list(first); } const loadedOptions = result.can_create ? await syllabus.options() : null; setData(result); setOptions(loadedOptions); writeWorkspaceCache(dataKey, { data: result, options: loadedOptions }); setError(""); }
    catch (e) { setError(e instanceof ApiError && e.status === 404 ? "The syllabus service needs the latest backend update before shared resources can load." : errorText(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let result = await syllabus.list(studentCode || undefined);
        if (!studentCode && result.role === "parent" && result.students.length) {
          const first = result.students[0].code;
          setChild(first);
          result = await syllabus.list(first);
        }
        const loadedOptions = result.can_create ? await syllabus.options() : null;
        if (active) { setData(result); setOptions(loadedOptions); writeWorkspaceCache(dataKey, { data: result, options: loadedOptions }); setError(""); setBusy(false); }
      } catch (e) {
        if (active) { setError(e instanceof ApiError && e.status === 404 ? "The syllabus service needs the latest backend update before shared resources can load." : errorText(e)); setBusy(false); }
      }
    })();
    return () => { active = false; };
  }, [studentCode, dataKey]);
  const courses = options?.courses.filter((row) => row.course_level === level) || [];
  const courseNames = [...new Set(courses.map((row) => row.name))];
  const specializations = courses.filter((row) => row.name === courseName);
  const selectedCourse = specializations.find((row) => row.code === programCode);
  const years = options?.academic_years.filter((row) => row.program_code === programCode) || [];
  const items = useMemo(() => (data?.items || []).filter((row) => `${row.syllabus_name} ${row.course_name} ${row.specialization} ${row.batch_name}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  async function open(file: SyllabusFile) {
    try { const blob = await syllabus.bytes(file); if (file.mime_type === "application/pdf") window.dispatchEvent(new CustomEvent("college:pdf-preview", { detail: { name: file.filename, blob } })); else { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.filename; anchor.target = "_blank"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); } }
    catch (e) { toast.error("Could not open resource", errorText(e)); }
  }
  function openComposer() { setLevel("intermediate"); setCourseName(""); setProgramCode(""); setSpecialization(""); setYear(""); setName(""); setDescription(""); setFiles([]); setCreating(true); void syllabus.options("intermediate").then(setOptions).catch((e) => setError(errorText(e))); }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedCourse || !year || !files.length) return;
    setSaving(true);
    try {
      const uploaded = await Promise.all(files.map((file) => syllabus.upload(file)));
      await syllabus.create({ course_level: level, program_code: programCode, specialization, academic_year_code: year, syllabus_name: name.trim(), description: description.trim(), attachments: uploaded.map((file) => file.code) });
      toast.success("Shared resource published", "Students and linked parents have been notified."); setCreating(false); await load();
    } catch (e) { toast.error("Could not publish resource", errorText(e)); }
    finally { setSaving(false); }
  }
  const canCreate = data?.can_create ?? roleCreate;
  return <main className="as-workspace">
    <header className="as-header"><div><span className="as-eyebrow">ACADEMIC LIBRARY</span><h1>Syllabus &amp; resources</h1><p>Publish course materials to the right academic year. Students and parents can preview and download every file.</p></div>{canCreate && <WorkspacePrimaryAction onClick={openComposer}><Plus size={17}/> Add shared resource</WorkspacePrimaryAction>}</header>
    <section className="as-metrics"><div><BookOpen/><span><b>{data?.items.length || 0}</b><small>Shared resources</small></span></div><div><FileText/><span><b>{data?.items.reduce((n, row) => n + row.attachments.length, 0) || 0}</b><small>Files available</small></span></div></section>
    {data?.role === "parent" && data.students.length > 1 && <label className="as-parent-select">Student<select value={child} onChange={(e) => { setChild(e.target.value); void load(e.target.value); }}><option value="">Choose a student</option>{data.students.map((student) => <option key={student.code} value={student.code}>{student.name}</option>)}</select></label>}
    <div className="as-toolbar"><label><Search size={16}/><input placeholder="Search syllabus and files" value={search} onChange={(e) => setSearch(e.target.value)}/></label><button type="button" onClick={() => void load()} disabled={busy}>Refresh</button></div>
    {error && <div className="as-alert" role="status">{error}<button onClick={() => void load()}>Retry</button></div>}
    {busy && <div className="as-empty">Loading shared resources…</div>}
    {!busy && !error && items.length === 0 && <div className="as-empty"><BookOpen/><h2>No shared resources yet</h2><p>Published syllabus and course materials for your academic year will appear here.</p></div>}
    <div className="as-cards">{items.map((row: SyllabusRecord) => <article className="as-card" key={row.code}><div className="as-card-top"><span className="as-pill">{row.course_level === "degree" ? "Degree" : "Intermediate"}</span><span className="as-date">{new Date(row.created_at || "").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div><h2>{row.syllabus_name}</h2><p className="as-audience">{row.course_name} · {row.specialization} · {row.batch_name}</p>{row.description && <p className="as-description">{row.description}</p>}<AttachmentList files={row.attachments} onOpen={open}/></article>)}</div>
    {creating && <SideDrawer title="Add syllabus or learning resource" subtitle="Choose the course audience, add a name and description, then attach PDF or image files." className="as-drawer" actions={<button type="submit" form="syllabus-publish-form" className="as-primary" disabled={saving || !options?.can_create}>{saving ? "Publishing…" : "Publish to students"}</button>} onClose={() => !saving && setCreating(false)}><form id="syllabus-publish-form" className="as-form" onSubmit={publish}><fieldset><legend>Course audience</legend><label>Course level<select value={level} onChange={(e) => { setLevel(e.target.value); setCourseName(""); setProgramCode(""); setSpecialization(""); setYear(""); void syllabus.options(e.target.value).then(setOptions).catch((err) => setError(errorText(err))); }}><option value="intermediate">Intermediate</option><option value="degree">Degree</option></select></label><label>Course<select required value={courseName} onChange={(e) => { setCourseName(e.target.value); setProgramCode(""); setSpecialization(""); setYear(""); }}><option value="">Select course</option>{courseNames.map((course) => <option key={course} value={course}>{course}</option>)}</select></label><label>Course specialization<select required disabled={!courseName} value={programCode} onChange={(e) => { const selected = specializations.find((row) => row.code === e.target.value); setProgramCode(e.target.value); setSpecialization(selected?.specialization || ""); setYear(""); }}><option value="">Select specialization</option>{specializations.map((row) => <option key={row.code} value={row.code}>{row.specialization}</option>)}</select></label><label>Academic year<select required disabled={!programCode} value={year} onChange={(e) => setYear(e.target.value)}><option value="">Select academic year</option>{years.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label></fieldset><fieldset><legend>Syllabus details</legend><label>Syllabus name<input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. First semester course materials"/></label><label>Description<textarea rows={4} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain what students will find in these files"/></label></fieldset><fieldset><legend>Upload resources</legend><label className="as-upload"><span><FileText size={16}/> Add PDF or image files</span><input type="file" multiple accept={allowed} onChange={(e) => { const picked = Array.from(e.target.files || []); if (picked.length > 10 || picked.some((f) => f.size > 10 * 1024 * 1024)) { toast.error("Choose up to 10 files, each no larger than 10 MB."); e.target.value = ""; return; } setFiles(picked); }}/><small>{files.length ? files.map((f) => f.name).join(", ") : "Select up to 10 PDF, JPG, PNG or WebP files. Each file may be up to 10 MB."}</small></label></fieldset>{(!options?.can_create || !options) && <p className="as-field-note">Your role cannot publish resources here, or the latest backend update is needed. Refresh options after the update.</p>}</form></SideDrawer>}
  </main>;
}
