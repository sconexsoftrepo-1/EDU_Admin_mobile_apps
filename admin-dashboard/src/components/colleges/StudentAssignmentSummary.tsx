"use client";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { useEffect, useState } from "react";
import { apiRequest, errorText } from "@/services/api/client";
import { assignmentPath, type Submission } from "@/services/api/modules/assignments/service";
import { useOptionalCollege } from "./CollegeStore";
interface AcademicAssignments {items:{code:string;title:string;max_marks:string;submission:Submission|null}[];summary:{assigned:number;completed:number;marks:string;max_marks:string;percentage:string|null};}
function Summary({student}:{student:string}) {
  const [value,setValue]=useState<AcademicAssignments|null>(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;void apiRequest<AcademicAssignments>(`${assignmentPath}/students/${encodeURIComponent(student)}/academics`).then(data=>{if(active)setValue(data);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[student]);
  if(error)return <p role="status">Assignment academics are currently unavailable.</p>;
  if(!value)return <WorkspaceSkeleton compact label="Loading assignment academics" />;
  return <><p>{value.summary.completed} / {value.summary.assigned} completed{value.summary.percentage!==null?` · ${value.summary.marks} / ${value.summary.max_marks} reviewed marks (${value.summary.percentage}%)`:""}</p>{!value.items.length?<p>No assignments allocated to this student.</p>:<div className="edu-table"><table><thead><tr><th>Assignment</th><th>Status</th><th>Marks</th><th>Feedback</th></tr></thead><tbody>{value.items.map(a=><tr key={a.code}><td>{a.title}</td><td>{a.submission?.completed?"Completed":a.submission?.submitted_at?"Submitted":"Awaiting submission"}</td><td>{a.submission?.marks!=null?`${a.submission.marks} / ${a.max_marks}`:"—"}</td><td>{a.submission?.feedback||"—"}</td></tr>)}</tbody></table></div>}</>;
}
export default function StudentAssignmentSummary({student}:{student:string}) {
 const session=useOptionalCollege();const role=session?.activeRole;
 const allowed=role?.system_admin||role?.scope==="teaching"||role?.permissions.assignments?.includes("view");
 const [open,setOpen]=useState(false);
 if(!allowed)return null;
 return <details className="edu-student-detail-section" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Assignment academics</summary>{open&&<Summary student={student}/>}</details>;
}
