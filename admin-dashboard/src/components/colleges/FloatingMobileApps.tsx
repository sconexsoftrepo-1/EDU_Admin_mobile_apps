"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Smartphone, X } from "lucide-react";
import type { College } from "@/data/colleges";
import { useCollege } from "./CollegeStore";
const Apps = dynamic(() => import("./MobileAppsWorkspace"), {
  loading: () => <p role="status">Opening campus apps…</p>,
});
export default function FloatingMobileApps({ college }: { college: College }) {
  const { role } = useCollege();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    launcher = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const d = dialog.current,
      trigger = launcher.current,
      previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    d?.showModal();
    return () => {
      d?.close();
      document.body.style.overflow = previous;
      trigger?.focus();
    };
  }, [open]);
  if (!role || !["Super Admin", "Parent", "Student", "Faculty"].includes(role))
    return null;
  return (
    <>
      <button
        ref={launcher}
        className="erp-mobile-app-launcher"
        aria-label="Open mobile apps"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Smartphone size={22} />
        <span>Mobile apps</span>
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="erp-mobile-app-drawer"
          aria-labelledby="mobile-app-drawer-title"
          onCancel={() => setOpen(false)}
        >
          <header>
            <div>
              <small>{college.name}</small>
              <h2 id="mobile-app-drawer-title">Mobile apps</h2>
              <p>
                Parent, Student and Teacher apps connected to campus records.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close mobile apps"
              onClick={() => setOpen(false)}
            >
              <X size={21} />
            </button>
          </header>
          <div className="erp-mobile-app-drawer-body">
            <Apps college={college} />
          </div>
        </dialog>
      )}
    </>
  );
}
