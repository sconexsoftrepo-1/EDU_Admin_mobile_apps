import { apiRequest } from "@/services/api/client";

export const timetableDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export type TemplateKind = "intermediate" | "degree";
export type Period = {
  start: string;
  end: string;
  kind: "teaching" | "break" | "lunch";
  label: string;
};
export type TimetableCell = {
  day: number;
  row: number;
  span: number;
  kind: "theory" | "lab" | "activity";
  title: string;
  subject_code: string;
  faculty: string;
  room: string;
};
export type TimetableDraft = {
  name: string;
  template: TemplateKind;
  program_code: string;
  batch_code: string;
  study_year: number;
  semester: number;
  section: string;
  coordinator: string;
  status: "Draft" | "Published";
  revision: number;
  periods: Period[];
  cells: TimetableCell[];
};
export type TimetableRecord = TimetableDraft & {
  code: string;
  course_name: string;
  batch_name: string;
  updated_at: string;
};
export type TimetableOptions = {
  courses: {
    code: string;
    name: string;
    course_level: string;
    duration_semesters: number;
  }[];
  batches: {
    code: string;
    name: string;
    program_code: string;
    entry_year: number;
    graduation_year: number;
  }[];
};
export type TimetableList = {
  items: TimetableRecord[];
  can_create: boolean;
  can_edit: boolean;
};
const endpoint = "academics/timetable-templates";
export const timetableApi = {
  list: () => apiRequest<TimetableList>(endpoint),
  options: () => apiRequest<TimetableOptions>(`${endpoint}/options`),
  save: (draft: TimetableDraft, code?: string) =>
    apiRequest<TimetableRecord>(
      code ? `${endpoint}/${encodeURIComponent(code)}` : endpoint,
      { method: code ? "PUT" : "POST", body: draft },
    ),
};
export function emptyCell(day: number, row: number): TimetableCell {
  return {
    day,
    row,
    span: 1,
    kind: "theory",
    title: "",
    subject_code: "",
    faculty: "",
    room: "",
  };
}
export function createTimetable(template: TemplateKind): TimetableDraft {
  const periods: Period[] = [
    { start: "09:00", end: "10:00", kind: "teaching", label: "Period 1" },
    { start: "10:00", end: "11:00", kind: "teaching", label: "Period 2" },
    { start: "11:00", end: "11:30", kind: "break", label: "Morning break" },
    { start: "11:30", end: "12:30", kind: "teaching", label: "Period 3" },
    { start: "12:30", end: "13:30", kind: "lunch", label: "Lunch" },
    { start: "13:30", end: "14:30", kind: "teaching", label: "Period 4" },
    { start: "14:30", end: "15:30", kind: "teaching", label: "Period 5" },
    { start: "15:30", end: "16:00", kind: "teaching", label: "Period 6" },
  ];
  const cells: TimetableCell[] =
    template === "degree"
      ? [
          { ...emptyCell(0, 0), kind: "lab", span: 2 },
          { ...emptyCell(2, 5), kind: "lab", span: 3 },
          { ...emptyCell(1, 6), kind: "activity", span: 2 },
          { ...emptyCell(4, 6), kind: "activity", span: 2 },
        ]
      : [
          { ...emptyCell(2, 5), kind: "lab", span: 2 },
          { ...emptyCell(5, 6), kind: "activity", span: 2 },
        ];
  return {
    name: "Weekly timetable",
    template,
    program_code: "",
    batch_code: "",
    study_year: 1,
    semester: 1,
    section: "A",
    coordinator: "",
    status: "Draft",
    revision: 0,
    periods,
    cells,
  };
}
export function cellAt(draft: TimetableDraft, day: number, row: number) {
  return draft.cells.find(
    (c) => c.day === day && c.row <= row && c.row + c.span > row,
  );
}
export function editCell(
  draft: TimetableDraft,
  cell: TimetableCell,
): TimetableDraft {
  return {
    ...draft,
    cells: [
      ...draft.cells.filter((c) => c.day !== cell.day || c.row !== cell.row),
      cell,
    ],
  };
}
export function resizeCell(
  draft: TimetableDraft,
  day: number,
  row: number,
  span: number,
): TimetableDraft {
  const cell = cellAt(draft, day, row) || emptyCell(day, row);
  if (cell.row !== row || span < 1 || row + span > draft.periods.length)
    throw Error("Choose a valid number of periods.");
  for (let i = row; i < row + span; i++) {
    if (draft.periods[i].kind !== "teaching")
      throw Error("A class cannot extend across a break or lunch.");
    const other = cellAt(draft, day, i);
    if (
      other &&
      other !== cell &&
      (other.title ||
        other.faculty ||
        other.room ||
        other.subject_code ||
        other.span > 1)
    )
      throw Error("Clear the next class before expanding into its box.");
  }
  return {
    ...draft,
    cells: [
      ...draft.cells.filter(
        (c) =>
          c.day !== day ||
          c.row < row ||
          c.row >= row + Math.max(cell.span, span),
      ),
      { ...cell, span },
    ],
  };
}
export function removePeriod(
  draft: TimetableDraft,
  row: number,
): TimetableDraft {
  if (draft.periods.length === 1) throw Error("Keep at least one period.");
  return {
    ...draft,
    periods: draft.periods.filter((_, i) => i !== row),
    cells: draft.cells.flatMap((c) => {
      if (c.row === row && c.span === 1) return [];
      return [
        {
          ...c,
          row: c.row > row ? c.row - 1 : c.row,
          span: c.row <= row && c.row + c.span > row ? c.span - 1 : c.span,
        },
      ];
    }),
  };
}

/** Add a block around the existing day without shifting any recorded class times. */
export function addDayEdge(
  draft: TimetableDraft,
  edge: "morning" | "evening",
  kind: Period["kind"] = "teaching",
): TimetableDraft {
  if (draft.periods.length >= 24)
    throw Error("A timetable can contain up to 24 blocks.");
  const duration = kind === "teaching" ? 60 : 30;
  const clock =
    edge === "morning" ? draft.periods[0].start : draft.periods.at(-1)!.end;
  const boundary = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  const start = edge === "morning" ? boundary - duration : boundary;
  const end = start + duration;
  if (start < 0 || end >= 1440)
    throw Error(
      "The new block must fit within the same day. Adjust the first or last time first.",
    );
  const format = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const period: Period = {
    start: format(start),
    end: format(end),
    kind,
    label:
      kind === "teaching"
        ? `${edge === "morning" ? "Morning" : "Evening"} period`
        : kind === "break"
          ? "Break"
          : "Lunch",
  };
  return {
    ...draft,
    periods:
      edge === "morning"
        ? [period, ...draft.periods]
        : [...draft.periods, period],
    cells:
      edge === "morning"
        ? draft.cells.map((c) => ({ ...c, row: c.row + 1 }))
        : draft.cells,
  };
}
export function timetablePayload(record: TimetableDraft): TimetableDraft {
  const {
    name,
    template,
    program_code,
    batch_code,
    study_year,
    semester,
    section,
    coordinator,
    status,
    revision,
    periods,
    cells,
  } = record;
  return {
    name,
    template,
    program_code,
    batch_code,
    study_year,
    semester,
    section,
    coordinator,
    status,
    revision,
    periods,
    cells,
  };
}
