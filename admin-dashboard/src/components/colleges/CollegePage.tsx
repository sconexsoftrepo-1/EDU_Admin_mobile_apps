"use client";
import dynamic from "next/dynamic";
import { CollegeStore, useCollege } from "./CollegeStore";
import CollegePublic from "./CollegePublic";
import { collegeRoot, type College } from "@/data/colleges";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
const Portal = dynamic(() => import("./CollegePortal"), {
  loading: () => <div className="erp-loading">Loading campus workspace…</div>,
});
function Verification({ college: c, id }: { college: College; id: string }) {
  const { state: s, ready } = useCollege(),
    r = s.certificates.find((x) => x.id === id && x.status === "Issued"),
    st = s.students.find((x) => x.id === r?.studentId);
  return (
    <main className="college-verification">
      <ShieldCheck size={50} />
      <h1>Certificate verification demo</h1>
      <p>{c.name}</p>
      {!ready ? (
        <p>Checking demo records…</p>
      ) : r ? (
        <>
          <h2>Found in this browser’s demo records</h2>
          <dl>
            <dt>Reference</dt>
            <dd>{r.id}</dd>
            <dt>Certificate</dt>
            <dd>{r.name}</dd>
            <dt>Student</dt>
            <dd>
              {st?.name.slice(0, 1)}•••• / ••••{st?.id.slice(-3)}
            </dd>
            <dt>Issue date</dt>
            <dd>{r.approvedAt?.slice(0, 10) || r.date}</dd>
            <dt>Status</dt>
            <dd>Issued (demonstration)</dd>
          </dl>
        </>
      ) : (
        <h2>No issued demo certificate found</h2>
      )}
      <p>
        Records are stored in this browser only. This does not establish
        real-world authenticity or cryptographic validity.
      </p>
      <Link className="college-button" href={collegeRoot(c)}>
        Return to college
      </Link>
    </main>
  );
}
export default function CollegePage({
  college,
  parts,
}: {
  college: College;
  parts: string[];
}) {
  return (
    <CollegeStore key={college.slug} slug={college.slug}>
      {parts[0] === "portal" ? (
        <Portal college={college} parts={parts} />
      ) : parts[0] === "verify-certificate" ? (
        <Verification college={college} id={parts[1]} />
      ) : (
        <CollegePublic college={college} parts={parts} />
      )}
    </CollegeStore>
  );
}
