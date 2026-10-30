"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Clock3, ImagePlus, MapPin, Plus, Search } from "lucide-react";
import SideDrawer from "./SideDrawer";
import Image from "next/image";
import { useOptionalCollege } from "./CollegeStore";
import { ApiError, errorText } from "@/services/api";
import { calendar, type CalendarData, type CalendarEvent, type CalendarImage, type CalendarOptions } from "@/services/api/modules/assignments/calendar";
import { toast } from "./toast";
import WorkspacePrimaryAction from "./WorkspacePrimaryAction";
import "./assignment-workspace.css";
import "./calendar-workspace.css";
import { readWorkspaceCache, workspaceCacheKey, writeWorkspaceCache } from "@/lib/colleges/workspace-cache";

const asLocalDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const showDate = (value: string) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
function audienceText(event: CalendarEvent, options?: CalendarOptions) {
  if (event.audience_type === "department") return options?.departments.find((row) => row.code === event.audience_code)?.name || "Selected department";
  if (event.audience_type === "intermediate") return "All Intermediate students";
  if (event.audience_type === "degree") return "All Degree students";
  if (event.audience_type === "program") return options?.courses.find((row) => row.code === event.audience_code)?.name || "Selected course specialization";
  return "All departments and courses";
}
export default function CalendarWorkspace({ studentCode }: { studentCode?: string }) {
  const session = useOptionalCollege();
  const role = session?.activeRole;
  const dataKey = workspaceCacheKey(session?.account?.code, role?.code, `special:calendar:${studentCode || "self"}`);
  const cached = readWorkspaceCache<{ data: CalendarData; options: CalendarOptions | null }>(dataKey);
  const roleCanCreate = !!session?.account && !["student", "parent"].includes(session.account.person_type) && !!role && (role.system_admin || role.permissions.calendar_events?.includes("create"));
  const [data, setData] = useState<CalendarData | null>(cached?.data || null), [options, setOptions] = useState<CalendarOptions | null>(cached?.options || null), [error, setError] = useState(""), [busy, setBusy] = useState(!cached), [query, setQuery] = useState(""), [child, setChild] = useState(studentCode || ""), [creating, setCreating] = useState(false), [detail, setDetail] = useState<CalendarEvent | null>(null), [imagePreview, setImagePreview] = useState<{ code: string; url: string } | null>(null), [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(""), [place, setPlace] = useState(""), [kind, setKind] = useState("academic"), [start, setStart] = useState(""), [endDate, setEndDate] = useState(""), [short, setShort] = useState(""), [description, setDescription] = useState(""), [audience, setAudience] = useState("all"), [audienceCode, setAudienceCode] = useState(""), [image, setImage] = useState<File | null>(null), [optionsLoading, setOptionsLoading] = useState(false);
  async function load(selected = child) {
    if (!data) setBusy(true);
    try { let result = await calendar.list(selected || undefined); if (!selected && result.role === "parent" && result.students.length) { const first = result.students[0].code; setChild(first); result = await calendar.list(first); } const loadedOptions = result.can_create ? await calendar.options() : null; setData(result); setOptions(loadedOptions); writeWorkspaceCache(dataKey, { data: result, options: loadedOptions }); setError(""); }
    catch (e) { setError(e instanceof ApiError && e.status === 404 ? "The calendar workspace needs the latest backend update." : errorText(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let result = await calendar.list(studentCode || undefined);
        if (!studentCode && result.role === "parent" && result.students.length) {
          const first = result.students[0].code;
          setChild(first);
          result = await calendar.list(first);
        }
        const loadedOptions = result.can_create ? await calendar.options() : null;
        if (active) { setData(result); setOptions(loadedOptions); writeWorkspaceCache(dataKey, { data: result, options: loadedOptions }); setError(""); setBusy(false); }
      } catch (e) {
        if (active) { setError(e instanceof ApiError && e.status === 404 ? "The calendar workspace needs the latest backend update." : errorText(e)); setBusy(false); }
      }
    })();
    return () => { active = false; };
  }, [studentCode, dataKey]);
  const detailImage = detail?.image;
  useEffect(() => {
    if (!detailImage) return;
    let active = true;
    let object = "";
    calendar.bytes(detailImage).then((blob) => {
      object = URL.createObjectURL(blob);
      if (active) setImagePreview({ code: detailImage.code, url: object });
      else URL.revokeObjectURL(object);
    }).catch(() => undefined);
    return () => { active = false; if (object) URL.revokeObjectURL(object); };
  }, [detailImage]);
  const imageUrl = detail?.image && imagePreview?.code === detail.image.code ? imagePreview.url : "";
  const canCreate = data?.can_create ?? roleCanCreate;
  const events = useMemo(() => (data?.items || []).filter((event) => `${event.title} ${event.place} ${event.short_description} ${event.description}`.toLowerCase().includes(query.toLowerCase())), [data, query]);
  const courses = options?.courses.filter((course) => audience === "intermediate" ? course.course_level === "intermediate" : audience === "degree" ? course.course_level === "degree" : true) || [];
  function reset() { setTitle(""); setPlace(""); setKind("academic"); setStart(asLocalDateTime(new Date(Date.now() + 86400000))); setEndDate(""); setShort(""); setDescription(""); setAudience("all"); setAudienceCode(""); setImage(null); }
  async function openCreate() {
    if (!canCreate) return;
    reset(); setOptionsLoading(true);
    try {
      const liveOptions = await calendar.options();
      setOptions(liveOptions); setCreating(true); setError("");
    } catch (e) { setError(errorText(e)); }
    finally { setOptionsLoading(false); }
  }
  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!start) return;
    setSaving(true);
    try {
      let uploaded: CalendarImage | undefined;
      if (image) uploaded = await calendar.upload(image);
      const startDate = new Date(start);
      const end = endDate ? new Date(`${endDate}T${start.slice(11, 16)}`) : null;
      if (end && end < startDate) throw new Error("End date must be on or after the start date.");
      await calendar.create({ title: title.trim(), place: place.trim(), event_type: kind, starts_at: startDate.toISOString(), ends_at: end?.toISOString() || null, short_description: short.trim(), description: description.trim(), audience_type: audience, audience_code: ["department", "program"].includes(audience) ? audienceCode : null, image_code: uploaded?.code || null });
      toast.success("Calendar event published", "The selected students and parents have been notified."); setCreating(false); reset(); await load();
    } catch (e) { toast.error("Could not publish event", errorText(e)); }
    finally { setSaving(false); }
  }
  return <main className="as-workspace cal-workspace">
    <header className="as-header"><div><span className="as-eyebrow">CAMPUS PLANNING</span><h1>Add &amp; manage Academic calendar</h1><p>Create an event for the whole college or a specific student group. Students and linked parents see events that match their enrollment.</p></div><WorkspacePrimaryAction disabled={!canCreate || optionsLoading} busy={optionsLoading} onClick={() => void openCreate()}><Plus size={17}/> {optionsLoading ? "Loading options…" : "Add event"}</WorkspacePrimaryAction></header>
    {data?.role === "parent" && data.students.length > 1 && <label className="as-parent-select">Student<select value={child} onChange={(e) => { setChild(e.target.value); void load(e.target.value); }}><option value="">Choose a student</option>{data.students.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>}
    <div className="as-toolbar"><label><Search size={16}/><input placeholder="Search calendar events" value={query} onChange={(e) => setQuery(e.target.value)}/></label><button onClick={() => void load()} disabled={busy}>Refresh</button></div>
    {error && <div className="as-alert" role="status">{error}<button onClick={() => void load()}>Retry</button></div>}{busy && <div className="as-empty">Loading calendar…</div>}
    {!busy && !error && events.length === 0 && <div className="as-empty"><CalendarDays/><h2>No events in the calendar</h2><p>Published events for the selected audience will appear here.</p></div>}
    <div className="cal-event-list">{events.map((event) => <article className="cal-event-card" key={event.code}><button className="cal-event-info" aria-label={`View details for ${event.title}`} title="Event details" onClick={() => setDetail(event)}>i</button>{event.image && <span className="cal-image-mark"><ImagePlus size={17}/></span>}<div><span className="as-pill">{event.event_type}</span><h2>{event.title}</h2><p><Clock3 size={15}/>{showDate(event.starts_at)}{event.ends_at && new Date(event.ends_at).toDateString() !== new Date(event.starts_at).toDateString() ? ` – ${showDate(event.ends_at)}` : " · One day"}</p>{event.place && <p><MapPin size={15}/>{event.place}</p>}<small>{audienceText(event, options || undefined)}</small><p className="cal-short">{event.short_description}</p></div></article>)}</div>
    {creating && <SideDrawer title="Add calendar event" subtitle="Choose who should see the event and provide the information students and parents need." className="as-drawer" actions={<button form="calendar-event-form" className="as-primary" disabled={saving || !options?.can_create}>{saving ? "Publishing…" : "Publish event"}</button>} onClose={() => { if (!saving) setCreating(false); }}><form id="calendar-event-form" className="as-form" onSubmit={publish}><fieldset><legend>Event details</legend><label>Event name<input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual sports day"/></label><label>Place<input maxLength={200} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Campus auditorium"/></label><label>Event type<select value={kind} onChange={(e) => setKind(e.target.value)}>{(options?.event_types || []).map((value) => <option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label><label>Start date and time<input required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}/></label><label>End date <span className="cal-optional">(optional)</span><input type="date" min={start.slice(0,10)} value={endDate} onChange={(e) => setEndDate(e.target.value)}/><small>Leave empty for a one-day event.</small></label></fieldset><fieldset><legend>Audience</legend><label>Who should see this event?<select value={audience} onChange={(e) => { setAudience(e.target.value); setAudienceCode(""); }}><option value="all">All departments and courses</option><option value="department">One department</option><option value="intermediate">All Intermediate courses</option><option value="degree">All Degree courses</option><option value="program">One course specialization</option></select></label>{audience === "department" && <label>Department<select required disabled={!options?.departments.length} value={audienceCode} onChange={(e) => setAudienceCode(e.target.value)}><option value="">{options?.departments.length ? "Choose a department" : "No departments are registered"}</option>{options?.departments.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select>{!options?.departments.length && <small>Add departments in College records to make them available here.</small>}</label>}{audience === "program" && <label>Course specialization<select required value={audienceCode} onChange={(e) => setAudienceCode(e.target.value)}><option value="">Select course</option>{courses.map((row) => <option key={row.code} value={row.code}>{row.course_level === "intermediate" ? "Inter" : "Degree"} · {row.name} · {row.specialization}</option>)}</select></label>}<p className="as-field-note">Matching students and parents who receive notifications will see this event in their calendar.</p></fieldset><fieldset><legend>Event message</legend><label>Short description<input required maxLength={300} value={short} onChange={(e) => setShort(e.target.value)} placeholder="A concise message for notifications"/></label><label>Detailed description<textarea rows={5} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Schedule, instructions, and other event information"/></label></fieldset><fieldset><legend>Event image</legend><label className="as-upload"><span><ImagePlus size={16}/> Add event picture</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] || null)}/><small>{image?.name || "Choose a JPG, PNG, or WebP image up to 10 MB. It appears on the event and rich push notification."}</small></label></fieldset></form></SideDrawer>}
    {detail && <SideDrawer title="Event details" subtitle="Academic calendar event" expanded className="as-drawer cal-detail-drawer" onClose={() => setDetail(null)}><div className="cal-detail">{imageUrl && <Image src={imageUrl} alt={`${detail.title} event`} width={1200} height={700} unoptimized />}{detail.image && !imageUrl && <div className="cal-image-placeholder"><ImagePlus/></div>}<h2>{detail.title}</h2><p className="cal-detail-meta"><Clock3 size={16}/>{showDate(detail.starts_at)}{detail.ends_at && new Date(detail.ends_at).toDateString() !== new Date(detail.starts_at).toDateString() ? ` – ${showDate(detail.ends_at)}` : " · One day"}</p>{detail.place && <p className="cal-detail-meta"><MapPin size={16}/>{detail.place}</p>}<span className="as-pill">{audienceText(detail, options || undefined)}</span><p className="cal-detail-short">{detail.short_description}</p><p className="cal-detail-long">{detail.description || "No additional details."}</p></div></SideDrawer>}
  </main>;
}
