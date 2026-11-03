"use client";
/**
 * Chats for the dashboard: a floating bubble (with the unread count) that opens a two-pane chat
 * window — conversations on the left, the open chat on the right (one pane at a time on phones).
 * Staff can start one-to-one chats (students, their parents, teachers, staff) and groups for a
 * course, branch, academic year or section. Messages carry text, photos, PDFs and voice notes.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  Mic,
  Paperclip,
  Pause,
  Play,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  chatService,
  type ChatMessage,
  type Contact,
  type Conversation,
  type GroupOptions,
} from "@/services/api/modules/chat/service";
import { errorText } from "@/services/api";
import { toast } from "../toast";
import "./chat.css";

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const DAYS = "Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(
  " ",
);

/** Current time in ms (only called from event handlers and timers). */
const stamp = () => Date.now();

function clock(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
function dayDiff(d: Date) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function listTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const diff = dayDiff(d);
  if (diff === 0) return clock(d);
  if (diff === 1) return "Yesterday";
  if (diff < 7) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`}`;
}
function dayLabel(d: Date) {
  const diff = dayDiff(d);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
const initials = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return p.length
    ? (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase()
    : "?";
};
const ROLE_LABEL: Record<string, string> = {
  teacher: "Teacher",
  staff: "Staff",
  student: "Student",
  parent: "Parent",
  group: "Group",
};
const duration = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function Avatar({
  name,
  role,
  size = 44,
}: {
  name: string;
  role: string;
  size?: number;
}) {
  return (
    <span
      className={`chat-avatar chat-role-${role || "other"}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {role === "group" ? <Users size={size * 0.48} /> : initials(name)}
    </span>
  );
}

// ---- Bubble ---------------------------------------------------------------------------------
export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [available, setAvailable] = useState(false);

  const refresh = useCallback(() => {
    chatService
      .unread()
      .then((r) => {
        setAvailable(true);
        setUnread(r.unread);
      })
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 30000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  if (!available) return null;
  return (
    <>
      {!open && (
        <button
          type="button"
          className="chat-fab"
          onClick={() => setOpen(true)}
          aria-label={unread ? `Chats, ${unread} unread` : "Chats"}
          title="Chats"
        >
          <MessageCircle size={26} aria-hidden="true" />
          {unread > 0 && (
            <span className="chat-fab-badge">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}
      {open && (
        <ChatWindow
          onClose={() => {
            setOpen(false);
            refresh();
          }}
          onUnread={setUnread}
        />
      )}
    </>
  );
}

// ---- Window ---------------------------------------------------------------------------------
function ChatWindow({
  onClose,
  onUnread,
}: {
  onClose: () => void;
  onUnread: (n: number) => void;
}) {
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [canGroup, setCanGroup] = useState(false);
  const [active, setActive] = useState<Conversation | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
  const [starting, setStarting] = useState<"" | "person" | "group">("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    chatService
      .conversations()
      .then((r) => {
        setItems(r.items);
        setCanGroup(r.can_create_groups);
        onUnread(r.unread);
        setError("");
      })
      .catch((e) => setError(errorText(e)));
  }, [onUnread]);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 10000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !starting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, starting]);

  const visible = useMemo(
    () =>
      (items || []).filter(
        (c) =>
          (filter !== "unread" || c.unread > 0) &&
          (filter !== "groups" || c.kind === "group") &&
          `${c.title} ${c.subtitle} ${c.last_message}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [items, filter, query],
  );

  function opened(c: Conversation) {
    setStarting("");
    setActive(c);
    setItems((list) =>
      list && !list.some((x) => x.code === c.code) ? [c, ...list] : list,
    );
  }

  return (
    <div
      className="chat-scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className={`chat-window ${active ? "chat-has-active" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Chats"
      >
        <aside className="chat-list-pane">
          <header className="chat-list-head">
            <h2>Chats</h2>
            <div className="chat-head-actions">
              {canGroup && (
                <button
                  type="button"
                  className="chat-icon-btn"
                  onClick={() => setStarting("group")}
                  title="New group"
                  aria-label="New group"
                >
                  <Users size={18} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className="chat-icon-btn chat-primary-btn"
                onClick={() => setStarting("person")}
                title="New chat"
                aria-label="New chat"
              >
                <UserPlus size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="chat-icon-btn"
                onClick={onClose}
                title="Close chats"
                aria-label="Close chats"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </header>
          <label className="chat-search">
            <Search size={16} aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
            />
          </label>
          <div
            className="chat-filters"
            role="tablist"
            aria-label="Filter chats"
          >
            {(["all", "unread", "groups"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={filter === f ? "on" : ""}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "unread" ? "Unread" : "Groups"}
              </button>
            ))}
          </div>
          <div className="chat-list" role="list">
            {!items ? (
              error ? (
                <p className="chat-empty">{error}</p>
              ) : (
                <div className="chat-loading">
                  <Loader2 className="chat-spin" size={22} />
                </div>
              )
            ) : !visible.length ? (
              <div className="chat-empty">
                <MessageCircle size={36} aria-hidden="true" />
                <strong>
                  {items.length ? "Nothing matches" : "No chats yet"}
                </strong>
                <span>
                  {items.length
                    ? "Try another search or filter."
                    : "Start a chat with a student, parent or teacher."}
                </span>
                {!items.length && (
                  <button
                    type="button"
                    className="chat-cta"
                    onClick={() => setStarting("person")}
                  >
                    Start a chat
                  </button>
                )}
              </div>
            ) : (
              visible.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  role="listitem"
                  className={`chat-row ${active?.code === c.code ? "on" : ""}`}
                  onClick={() => setActive(c)}
                >
                  <Avatar name={c.title} role={c.role} />
                  <span className="chat-row-main">
                    <span className="chat-row-top">
                      <strong>{c.title}</strong>
                      <small className={c.unread ? "fresh" : ""}>
                        {listTime(c.last_at)}
                      </small>
                    </span>
                    <span className="chat-row-bottom">
                      <span className="chat-preview">
                        {c.last_mine && !c.last_sender && (
                          <CheckCheck size={14} aria-hidden="true" />
                        )}
                        {c.last_message
                          ? `${c.last_sender ? c.last_sender + ": " : ""}${c.last_message}`
                          : c.subtitle}
                      </span>
                      {c.unread > 0 && (
                        <span
                          className="chat-count"
                          aria-label={`${c.unread} unread`}
                        >
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
        <div className="chat-thread-pane">
          {active ? (
            <Thread
              key={active.code}
              summary={active}
              onBack={() => {
                setActive(null);
                load();
              }}
              onRead={() =>
                setItems(
                  (list) =>
                    list &&
                    list.map((x) =>
                      x.code === active.code ? { ...x, unread: 0 } : x,
                    ),
                )
              }
            />
          ) : (
            <div className="chat-welcome">
              <MessageCircle size={56} aria-hidden="true" />
              <h3>Edu-Pragathi Chats</h3>
              <p>
                Message students, parents and staff. Share photos, PDFs and
                voice notes.
              </p>
              <button
                type="button"
                className="chat-cta"
                onClick={() => setStarting("person")}
              >
                Start a chat
              </button>
            </div>
          )}
        </div>
        {starting === "person" && (
          <NewChat
            onClose={() => setStarting("")}
            onOpened={opened}
            canGroup={canGroup}
            onGroup={() => setStarting("group")}
          />
        )}
        {starting === "group" && (
          <NewGroup onClose={() => setStarting("")} onOpened={opened} />
        )}
      </section>
    </div>
  );
}

// ---- New chat -------------------------------------------------------------------------------
function NewChat({
  onClose,
  onOpened,
  canGroup,
  onGroup,
}: {
  onClose: () => void;
  onOpened: (c: Conversation) => void;
  canGroup: boolean;
  onGroup: () => void;
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [people, setPeople] = useState<Contact[] | null>(null);
  const [everyone, setEveryone] = useState(false);
  const [busy, setBusy] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      chatService
        .directory({ q: q.trim(), role })
        .then((r) => {
          if (!live) return;
          setPeople(r.items);
          setEveryone(r.everyone);
        })
        .catch((e) => live && toast.error("Contacts", errorText(e)));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [q, role]);

  async function start(code: string) {
    setBusy(code);
    try {
      onOpened(await chatService.direct(code));
    } catch (e) {
      toast.error("Could not start the chat", errorText(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="chat-sheet" role="dialog" aria-label="New chat">
      <header>
        <button
          type="button"
          className="chat-icon-btn"
          onClick={onClose}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h3>New chat</h3>
      </header>
      <label className="chat-search">
        <Search size={16} aria-hidden="true" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, roll no., admission no. or phone"
          aria-label="Search people"
        />
      </label>
      {everyone && (
        <div className="chat-filters" aria-label="Who">
          {[
            ["", "Everyone"],
            ["student", "Students & parents"],
            ["teacher", "Teachers"],
            ["staff", "Staff"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={role === k ? "on" : ""}
              aria-pressed={role === k}
              onClick={() => setRole(k)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {canGroup && (
        <button
          type="button"
          className="chat-row chat-new-group"
          onClick={onGroup}
        >
          <span className="chat-avatar chat-role-group" aria-hidden="true">
            <Users size={20} />
          </span>
          <span className="chat-row-main">
            <strong>New group</strong>
            <span className="chat-preview">
              Course, branch, academic year or section
            </span>
          </span>
        </button>
      )}
      <div className="chat-list">
        {!people ? (
          <div className="chat-loading">
            <Loader2 className="chat-spin" size={22} />
          </div>
        ) : !people.length ? (
          <p className="chat-empty">Nobody matches this search.</p>
        ) : (
          people.map((p) => (
            <div key={p.code} className="chat-contact">
              <button
                type="button"
                className="chat-row"
                disabled={!!busy}
                onClick={() => void start(p.code)}
              >
                <Avatar name={p.name} role={p.role} />
                <span className="chat-row-main">
                  <span className="chat-row-top">
                    <strong>{p.name}</strong>
                    <small>{ROLE_LABEL[p.role] || ""}</small>
                  </span>
                  <span className="chat-preview">{p.detail}</span>
                </span>
                {busy === p.code && <Loader2 className="chat-spin" size={16} />}
              </button>
              {!!p.parents?.length && (
                <div className="chat-parents">
                  {p.parents.map((parent) => (
                    <button
                      key={`${p.code}-${parent.name}`}
                      type="button"
                      className="chat-parent"
                      disabled={!parent.can_chat || !!busy}
                      onClick={() => parent.code && void start(parent.code)}
                      title={
                        parent.can_chat
                          ? `Chat with ${parent.name}`
                          : "This parent has no app login yet"
                      }
                    >
                      <Avatar name={parent.name} role="parent" size={28} />
                      <span>
                        <strong>{parent.name}</strong>
                        <small>
                          {parent.relationship}
                          {parent.phone ? ` · ${parent.phone}` : ""}
                          {parent.can_chat ? "" : " · no app login"}
                        </small>
                      </span>
                      {parent.can_chat && (
                        <MessageCircle size={15} aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NewGroup({
  onClose,
  onOpened,
}: {
  onClose: () => void;
  onOpened: (c: Conversation) => void;
}) {
  const [options, setOptions] = useState<GroupOptions | null>(null);
  const [level, setLevel] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");
  const [audience, setAudience] = useState<"students" | "parents" | "both">(
    "both",
  );
  const [title, setTitle] = useState("");
  const [teachers, setTeachers] = useState(true);
  const [replies, setReplies] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    chatService
      .options()
      .then(setOptions)
      .catch((e) => toast.error("Group options", errorText(e)));
  }, []);

  const programs = (options?.programs || []).filter(
    (p) => !level || p.course_level === level,
  );
  const years = (options?.academic_years || []).filter(
    (y) => !program || y.program_code === program,
  );
  const sections = (options?.sections || []).filter(
    (s) =>
      (!level || s.course_level === level) &&
      (!program || s.program_code === program) &&
      (!year || s.academic_year_code === year),
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onOpened(
        await chatService.group({
          title: title.trim() || undefined,
          course_level: level || undefined,
          program_code: program || undefined,
          academic_year_code: year || undefined,
          section_code: section || undefined,
          audience,
          include_teachers: teachers,
          allow_replies: replies,
        }),
      );
      toast.success("Group created", "Everyone in it can see it in the app.");
    } catch (err) {
      toast.error("Could not create the group", errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="chat-sheet" onSubmit={submit} aria-label="New group">
      <header>
        <button
          type="button"
          className="chat-icon-btn"
          onClick={onClose}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h3>New group</h3>
      </header>
      {!options ? (
        <div className="chat-loading">
          <Loader2 className="chat-spin" size={22} />
        </div>
      ) : (
        <div className="chat-group-form">
          <p className="chat-hint">
            Choose who joins. Only staff post unless you allow replies — so
            students never chat with each other.
          </p>
          <label>
            <span>Group name (optional)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. BCA 2nd year — parents"
              maxLength={120}
            />
          </label>
          {!!options.course_levels.length && (
            <label>
              <span>Course</span>
              <select
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  setProgram("");
                  setYear("");
                  setSection("");
                }}
              >
                <option value="">Any</option>
                {options.course_levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>Branch / specialisation</span>
            <select
              value={program}
              onChange={(e) => {
                setProgram(e.target.value);
                setYear("");
                setSection("");
              }}
            >
              <option value="">Any</option>
              {programs.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Academic year</span>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setSection("");
              }}
            >
              <option value="">Any</option>
              {years.map((y) => (
                <option key={y.code} value={y.code}>
                  {y.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Section</span>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">Any</option>
              {sections.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="chat-audience">
            <legend>Members</legend>
            {(
              [
                ["students", "Students"],
                ["parents", "Parents"],
                ["both", "Both"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={audience === k ? "on" : ""}
                aria-pressed={audience === k}
                onClick={() => setAudience(k)}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <label className="chat-check">
            <input
              type="checkbox"
              checked={teachers}
              onChange={(e) => setTeachers(e.target.checked)}
            />
            Add their teachers
          </label>
          <label className="chat-check">
            <input
              type="checkbox"
              checked={replies}
              onChange={(e) => setReplies(e.target.checked)}
            />
            Members can reply in the group
          </label>
          <button
            type="submit"
            className="chat-cta"
            disabled={busy || !(level || program || year || section)}
          >
            {busy ? (
              <Loader2 className="chat-spin" size={16} />
            ) : (
              <Users size={16} />
            )}
            Create group
          </button>
        </div>
      )}
    </form>
  );
}

// ---- Conversation ---------------------------------------------------------------------------
function Thread({
  summary,
  onBack,
  onRead,
}: {
  summary: Conversation;
  onBack: () => void;
  onRead: () => void;
}) {
  const [info, setInfo] = useState<Conversation>(summary);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(0);
  const [showPeople, setShowPeople] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const discard = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const seq = useRef(0);
  const latest = useRef<ChatMessage[] | null>(null);
  const code = summary.code;

  useEffect(() => {
    latest.current = messages;
  }, [messages]);

  const scrollDown = () =>
    window.setTimeout(() => {
      if (list.current) list.current.scrollTop = list.current.scrollHeight;
    }, 30);

  useEffect(() => {
    let live = true;
    chatService
      .conversation(code)
      .then((r) => live && setInfo(r))
      .catch(() => undefined);
    chatService
      .messages(code)
      .then((r) => {
        if (!live) return;
        setMessages(r.items);
        setHasMore(r.has_more);
        onRead();
        scrollDown();
      })
      .catch((e) => live && toast.error("Chat", errorText(e)));
    field.current?.focus();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Poll for new messages and read ticks.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = latest.current;
      if (!current) return;
      const sent = current.filter((m) => !m.pending);
      const since =
        sent.length > 30 ? sent[sent.length - 30].sent_at : undefined;
      chatService
        .messages(code, since ? { after: since } : {})
        .then((r) => {
          if (!r.items.length) return;
          const el = list.current;
          const nearBottom =
            !!el && el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          let grew = false;
          setMessages((now) => {
            if (!now) return now;
            const next = [...now];
            for (const m of r.items) {
              const i = next.findIndex(
                (x) =>
                  x.code === m.code ||
                  (!!x.client_id && x.client_id === m.client_id),
              );
              if (i >= 0) next[i] = { ...m, localUrl: next[i].localUrl };
              else {
                next.push(m);
                grew = true;
              }
            }
            return next.sort((a, b) =>
              a.pending
                ? 1
                : b.pending
                  ? -1
                  : a.sent_at.localeCompare(b.sent_at),
            );
          });
          if (nearBottom) window.setTimeout(() => grew && scrollDown(), 0);
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [code]);

  async function loadOlder() {
    if (!messages?.length || !hasMore) return;
    const el = list.current;
    const before = el ? el.scrollHeight : 0;
    const r = await chatService.messages(code, { before: messages[0].sent_at });
    setMessages((m) => [...r.items, ...(m || [])]);
    setHasMore(r.has_more);
    window.setTimeout(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    }, 20);
  }

  async function deliver(
    draft: Pick<ChatMessage, "body" | "kind"> & {
      file?: File;
      durationMs?: number;
      localUrl?: string;
    },
  ) {
    const clientId = `w${stamp()}-${seq.current++}`;
    const pending: ChatMessage = {
      code: clientId,
      client_id: clientId,
      body: draft.body,
      kind: draft.kind,
      sent_at: new Date().toISOString(),
      mine: true,
      sender_code: "",
      sender_name: "You",
      sender_role: "",
      attachment: draft.file
        ? {
            code: "",
            name: draft.file.name,
            size: draft.file.size,
            duration_ms: draft.durationMs,
          }
        : null,
      pending: true,
      localUrl: draft.localUrl,
    };
    setMessages((m) => [...(m || []), pending]);
    scrollDown();
    try {
      const attachment = draft.file
        ? await chatService.upload(code, draft.file)
        : undefined;
      const sent = await chatService.send(code, {
        body: draft.body,
        attachment_code: attachment,
        duration_ms: draft.durationMs,
        client_id: clientId,
      });
      setMessages((m) =>
        (m || []).map((x) =>
          x.client_id === clientId ? { ...sent, localUrl: draft.localUrl } : x,
        ),
      );
    } catch (e) {
      setMessages((m) =>
        (m || []).map((x) =>
          x.client_id === clientId ? { ...x, pending: false, failed: true } : x,
        ),
      );
      toast.error("Message not sent", errorText(e));
    }
  }

  function sendText() {
    const body = text.trim();
    if (!body) return;
    setText("");
    void deliver({ body, kind: "text" });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  }

  function pickFile(file?: File | null) {
    if (!file) return;
    const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const image = /^image\/(png|jpeg|webp)$/.test(file.type);
    if (!pdf && !image) {
      toast.error("Unsupported file", "Send JPG, PNG or WebP photos, or PDFs.");
      return;
    }
    const caption = text.trim();
    setText("");
    void deliver({
      body: caption,
      kind: pdf ? "pdf" : "image",
      file,
      localUrl: image ? URL.createObjectURL(file) : undefined,
    });
  }

  async function startRecording() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      toast.error("Voice notes", "This browser cannot record audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      chunks.current = [];
      discard.current = false;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const ms = stamp() - started.current;
        if (discard.current) return;
        if (ms < 800) {
          toast.error("Voice notes", "Record a little longer.");
          return;
        }
        const type = rec.mimeType || mime || "audio/webm";
        const ext = type.includes("mp4")
          ? "m4a"
          : type.includes("ogg")
            ? "ogg"
            : "webm";
        const file = new File(chunks.current, `voice.${ext}`, { type });
        void deliver({
          body: "",
          kind: "audio",
          file,
          durationMs: ms,
          localUrl: URL.createObjectURL(file),
        });
      };
      recorder.current = rec;
      started.current = stamp();
      rec.start();
      setRecorded(0);
      setRecording(true);
    } catch {
      toast.error("Voice notes", "Allow microphone access to record.");
    }
  }

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(
      () => setRecorded(stamp() - started.current),
      250,
    );
    return () => window.clearInterval(timer);
  }, [recording]);

  function stopRecording(send: boolean) {
    discard.current = !send;
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  const group = info.kind === "group";
  return (
    <div className="chat-thread">
      <header className="chat-thread-head">
        <button
          type="button"
          className="chat-icon-btn chat-back"
          onClick={onBack}
          aria-label="Back to chats"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          className="chat-thread-title"
          onClick={() => group && setShowPeople((v) => !v)}
          aria-expanded={group ? showPeople : undefined}
        >
          <Avatar name={info.title} role={info.role} size={40} />
          <span>
            <strong>{info.title}</strong>
            <small>
              {group
                ? `${info.members} members · ${info.subtitle}`
                : info.subtitle}
            </small>
          </span>
        </button>
      </header>
      {showPeople && info.people && (
        <div className="chat-people">
          {info.people.map((p) => (
            <span key={p.code} className="chat-person">
              <Avatar name={p.name} role={p.role} size={26} />
              {p.name}
            </span>
          ))}
        </div>
      )}
      <div className="chat-messages" ref={list}>
        {hasMore && (
          <button
            type="button"
            className="chat-older"
            onClick={() => void loadOlder()}
          >
            Load earlier messages
          </button>
        )}
        {!messages ? (
          <div className="chat-loading">
            <Loader2 className="chat-spin" size={24} />
          </div>
        ) : !messages.length ? (
          <div className="chat-empty">
            <strong>Say hello 👋</strong>
            <span>
              {info.can_post
                ? "Send a message, photo, PDF or voice note."
                : "Messages from staff will appear here."}
            </span>
          </div>
        ) : (
          messages.map((m, i) => {
            const d = new Date(m.sent_at);
            const prev = i ? new Date(messages[i - 1].sent_at) : null;
            const newDay = !prev || prev.toDateString() !== d.toDateString();
            const showName =
              group &&
              !m.mine &&
              (newDay || messages[i - 1]?.sender_code !== m.sender_code);
            return (
              <div key={m.client_id || m.code}>
                {newDay && <div className="chat-day">{dayLabel(d)}</div>}
                <Bubble
                  m={m}
                  showName={showName}
                  onImage={setViewer}
                  onRetry={
                    m.failed
                      ? () => {
                          setMessages((all) =>
                            (all || []).filter((x) => x !== m),
                          );
                          if (m.kind === "text")
                            void deliver({ body: m.body, kind: "text" });
                          else
                            toast.error(
                              "Attach the file again",
                              "Files are sent again from the paperclip.",
                            );
                        }
                      : undefined
                  }
                />
              </div>
            );
          })
        )}
      </div>
      {info.can_post ? (
        recording ? (
          <div className="chat-composer chat-recording">
            <button
              type="button"
              className="chat-icon-btn"
              onClick={() => stopRecording(false)}
              aria-label="Discard recording"
              title="Discard"
            >
              <Trash2 size={18} />
            </button>
            <span className="chat-rec-dot" aria-hidden="true" />
            <span className="chat-rec-time" aria-live="polite">
              Recording {duration(recorded)}
            </span>
            <button
              type="button"
              className="chat-send"
              onClick={() => stopRecording(true)}
              aria-label="Send voice message"
            >
              <Send size={18} />
            </button>
          </div>
        ) : (
          <div className="chat-composer">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              hidden
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="chat-icon-btn"
              onClick={() => fileInput.current?.click()}
              aria-label="Attach photo or PDF"
              title="Attach photo or PDF"
            >
              <Paperclip size={19} />
            </button>
            <textarea
              ref={field}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              onPaste={(e) => {
                const file = [...e.clipboardData.files][0];
                if (file) {
                  e.preventDefault();
                  pickFile(file);
                }
              }}
              placeholder="Type a message"
              aria-label="Message"
              maxLength={4000}
            />
            {text.trim() ? (
              <button
                type="button"
                className="chat-send"
                onClick={sendText}
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="chat-send"
                onClick={() => void startRecording()}
                aria-label="Record voice message"
                title="Record voice message"
              >
                <Mic size={18} />
              </button>
            )}
          </div>
        )
      ) : (
        <p className="chat-readonly">
          Only staff can send messages in this group.
        </p>
      )}
      {viewer && (
        <div
          className="chat-viewer"
          role="dialog"
          aria-label="Photo"
          onClick={() => setViewer(null)}
        >
          <button
            type="button"
            className="chat-icon-btn"
            aria-label="Close photo"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer} alt="" />
        </div>
      )}
    </div>
  );
}

function Bubble({
  m,
  showName,
  onImage,
  onRetry,
}: {
  m: ChatMessage;
  showName: boolean;
  onImage: (url: string) => void;
  onRetry?: () => void;
}) {
  const url =
    m.localUrl ||
    (m.attachment?.code ? chatService.fileUrl(m.attachment.code) : "");
  const time = clock(new Date(m.sent_at));
  return (
    <div className={`chat-bubble-row ${m.mine ? "mine" : ""}`}>
      <div className={`chat-bubble ${m.failed ? "failed" : ""}`}>
        {showName && (
          <span className={`chat-sender chat-text-${m.sender_role}`}>
            {m.sender_name}
          </span>
        )}
        {m.kind === "image" && url && (
          <button
            type="button"
            className="chat-image"
            onClick={() => onImage(url)}
            aria-label="Open photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={m.body || "Photo"} loading="lazy" />
          </button>
        )}
        {m.kind === "pdf" && (
          <a
            className="chat-file"
            href={url || undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!url || m.pending}
          >
            <span className="chat-file-icon">PDF</span>
            <span>
              <strong>{m.attachment?.name || "Document.pdf"}</strong>
              <small>
                {m.pending
                  ? "Uploading…"
                  : `${Math.max(1, Math.round((m.attachment?.size || 0) / 1024))} KB · Open`}
              </small>
            </span>
            <FileText size={16} aria-hidden="true" />
          </a>
        )}
        {m.kind === "audio" && (
          <Voice
            url={url}
            durationMs={m.attachment?.duration_ms || 0}
            pending={!!m.pending}
          />
        )}
        {m.body && <p>{m.body}</p>}
        <span className="chat-meta">
          {time}
          {m.mine &&
            (m.failed ? (
              <button type="button" className="chat-retry" onClick={onRetry}>
                Not sent · Retry
              </button>
            ) : m.pending ? (
              <Clock size={13} aria-label="Sending" />
            ) : m.status === "read" ? (
              <CheckCheck size={14} className="chat-read" aria-label="Read" />
            ) : m.status === "delivered" ? (
              <CheckCheck size={14} aria-label="Delivered" />
            ) : (
              <Check size={14} aria-label="Sent" />
            ))}
        </span>
      </div>
    </div>
  );
}

function Voice({
  url,
  durationMs,
  pending,
}: {
  url: string;
  durationMs: number;
  pending: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(durationMs / 1000);
  return (
    <div className="chat-voice">
      <span className="chat-voice-mic" aria-hidden="true">
        <Mic size={16} />
      </span>
      <button
        type="button"
        className="chat-icon-btn"
        disabled={!url || pending}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        onClick={() => {
          const a = audio.current;
          if (!a) return;
          if (a.paused)
            void a
              .play()
              .catch(() =>
                toast.error(
                  "Voice note",
                  "This voice note can't be played here.",
                ),
              );
          else a.pause();
        }}
      >
        {pending ? (
          <Loader2 className="chat-spin" size={18} />
        ) : playing ? (
          <Pause size={18} />
        ) : (
          <Play size={18} />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={total || 1}
        step={0.1}
        value={Math.min(at, total || 1)}
        aria-label="Voice message position"
        onChange={(e) => {
          if (audio.current) audio.current.currentTime = Number(e.target.value);
        }}
      />
      <small>{duration((playing || at ? at : total) * 1000)}</small>
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setAt(0);
          }}
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) =>
            Number.isFinite(e.currentTarget.duration) &&
            setTotal(e.currentTarget.duration)
          }
        />
      )}
    </div>
  );
}
