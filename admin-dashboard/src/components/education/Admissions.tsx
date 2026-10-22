"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { School } from "@/data/education";
import {
  admissionsSchema,
  todayISO,
  type AdmissionsValues,
} from "@/lib/education/admissions";
import WhatsAppLink from "@/components/contact/WhatsAppLink";
import { enquiryMessage } from "@/lib/whatsapp";
export const admissionSteps = [
  [
    "Inquiry",
    "Choose a grade, tell us what you would like to know and explore the school concept.",
  ],
  [
    "Campus Visit",
    "Select a preferred visit date in the demonstration form. No real visit is scheduled.",
  ],
  [
    "Application",
    "A sample application would include guardian contact information and relevant prior-school documents.",
  ],
  [
    "Assessment",
    "A real school would explain its own age-appropriate review and support process.",
  ],
  [
    "Enrollment",
    "A real school confirms eligibility, terms and any required documents before enrollment.",
  ],
];
export default function Admissions({ school }: { school: School }) {
  const [step, setStep] = useState(0),
    [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AdmissionsValues>({
    resolver: zodResolver(admissionsSchema(school)),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      grade: "",
      date: "",
      message: "",
    },
  });
  const values = useWatch({ control });
  const error = (name: keyof AdmissionsValues) =>
    errors[name] ? (
      <span
        id={`admission-error-${name}`}
        role="alert"
        className="school-form-error"
      >
        {errors[name]?.message}
      </span>
    ) : null;
  return (
    <section className="school-admissions school-wrap" id="admissions-form">
      <div>
        <span className="school-eyebrow">A friendly first step</span>
        <h2>
          A new chapter
          <br />
          begins with hello.
        </h2>
        <p>
          Explore the admissions journey, then try a sample enquiry. No child’s
          personal details are needed.
        </p>
        <div
          className="school-steps"
          role="group"
          aria-label="Admissions journey"
        >
          {admissionSteps.map(([name], i) => (
            <button
              key={name}
              aria-pressed={step === i}
              onClick={() => setStep(i)}
            >
              <span>{i + 1}</span>
              {name}
            </button>
          ))}
        </div>
        <div className="school-step-detail" aria-live="polite">
          <h3>{admissionSteps[step][0]}</h3>
          <p>{admissionSteps[step][1]}</p>
        </div>
        <h3>Sample eligibility & documents</h3>
        <p>
          Choose one of the listed grades. A real school would confirm age
          eligibility, previous-school records and any necessary transfer
          documents. This demo does not collect documents or create a place
          offer.
        </p>
      </div>
      <div>
        {done ? (
          <div className="school-admission-success" role="status">
            <span>✓</span>
            <h3>Your demo enquiry is complete.</h3>
            <p>
              This is a demonstration inquiry. No school has received your
              information.
            </p>
            <p>Your entries were not stored or transmitted.</p>
            <button
              className="school-button"
              onClick={() => {
                reset();
                setDone(false);
              }}
            >
              Try another enquiry
            </button>
          </div>
        ) : (
          <form
            className="school-admission-form"
            noValidate
            onSubmit={handleSubmit(() => setDone(true))}
          >
            <label>
              Parent / guardian name
              <input
                {...register("name")}
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby={
                  errors.name ? "admission-error-name" : undefined
                }
              />
              {error("name")}
            </label>
            <label>
              Contact email
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={
                  errors.email ? "admission-error-email" : undefined
                }
              />
              {error("email")}
            </label>
            <label>
              Phone number
              <input
                {...register("phone")}
                type="tel"
                autoComplete="tel"
                aria-invalid={!!errors.phone}
                aria-describedby={
                  errors.phone ? "admission-error-phone" : undefined
                }
              />
              {error("phone")}
            </label>
            <label>
              Grade of interest
              <select
                {...register("grade")}
                aria-invalid={!!errors.grade}
                aria-describedby={
                  errors.grade ? "admission-error-grade" : undefined
                }
              >
                <option value="">Choose a grade</option>
                {school.grades.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
              {error("grade")}
            </label>
            <label>
              Preferred campus visit date
              <input
                {...register("date")}
                type="date"
                min={todayISO()}
                aria-invalid={!!errors.date}
                aria-describedby={
                  errors.date ? "admission-error-date" : undefined
                }
              />
              {error("date")}
            </label>
            <label>
              Your enquiry
              <textarea
                {...register("message")}
                rows={4}
                maxLength={2000}
                placeholder="What would you like to know? Please leave out a child’s personal details."
                aria-invalid={!!errors.message}
                aria-describedby={
                  errors.message ? "admission-error-message" : undefined
                }
              />
              {error("message")}
            </label>
            <button className="school-button" type="submit">
              Preview demo enquiry ↗
            </button>
            <p className="school-fine-print">
              Local demonstration only. No school receives these entries.
            </p>
            <WhatsAppLink
              message={enquiryMessage(`${school.name} website template`, {
                name: values.name,
                email: values.email,
                message: values.message,
              })}
              label="Discuss this website on WhatsApp"
            />
            <small>
              Real developer enquiry to Chaitanya. WhatsApp opens your draft;
              this does not apply to a school.
            </small>
          </form>
        )}
      </div>
    </section>
  );
}
