"use client";
import type { College } from "@/data/colleges";
import TimetableTemplateWorkspace from "./TimetableTemplateWorkspace";
import TimetableSessionOverview from "./TimetableSessionOverview";
export default function TimetableOverview({ college }: { college: College }) {
  return (
    <>
      <TimetableTemplateWorkspace college={college} />
      <details className="academic-advanced-records">
        <summary>Existing session timetable & calendar</summary>
        <TimetableSessionOverview college={college} />
      </details>
    </>
  );
}
