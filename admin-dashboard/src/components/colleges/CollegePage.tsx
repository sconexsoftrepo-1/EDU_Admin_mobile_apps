"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Portal from "./CollegePortal";
import CollegePublic from "./CollegePublic";
import { collegeRoot, type College } from "@/data/colleges";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { api, errorText, type CertificateVerification } from "@/services/api";
const Login = dynamic(() => import("./ConnectedPortal"));

function Verification({ college: c, id }: { college: College; id: string }) {
  const [result, setResult] = useState<CertificateVerification | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api.documents
      .verifyCertificate(id)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <main className="college-verification">
      <ShieldCheck size={50} />
      <h1>Certificate verification</h1>
      <p>{c.name}</p>
      {error ? (
        <h2>{error}</h2>
      ) : !result ? (
        <p>Checking the certificate signature…</p>
      ) : (
        <>
          <h2>
            {result.valid
              ? "Signature verified"
              : result.revoked
                ? "Certificate revoked"
                : "Certificate could not be verified"}
          </h2>
          <dl>
            <dt>Certificate number</dt>
            <dd>{result.certificate_number}</dd>
            <dt>Issued on</dt>
            <dd>{result.issued_on}</dd>
            <dt>Signing mode</dt>
            <dd>{result.signer_type}</dd>
          </dl>
        </>
      )}
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
  if (parts[0] === "portal" && parts[1] === "login")
    return <Login college={college} parts={parts} loginRedirect />;
  if (parts[0] === "portal") return <Portal college={college} parts={parts} />;
  if (parts[0] === "verify-certificate")
    return <Verification college={college} id={parts[1]} />;
  return <CollegePublic college={college} parts={parts} />;
}
