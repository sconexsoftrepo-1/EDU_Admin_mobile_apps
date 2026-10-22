"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ArrowUpRight } from "lucide-react";
import { services } from "@/data/clinic";
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(100, "Please use 100 characters or fewer."),
  email: z.email("Please enter a valid email address."),
  service: z.string().min(1, "Choose a treatment or consultation."),
  date: z
    .string()
    .min(1, "Choose a preferred date.")
    .refine(
      (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        value >= new Date().toLocaleDateString("en-CA"),
      "Choose today or a future date.",
    ),
  notes: z.string().max(2000, "Please keep your note under 2,000 characters."),
  consent: z
    .boolean()
    .refine(Boolean, "Confirm that you understand this is a demo."),
});
type BookingValues = z.infer<typeof schema>;
export default function BookingForm() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BookingValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      service: "",
      date: "",
      notes: "",
      consent: false,
    },
  });
  const error = (name: keyof BookingValues) =>
    errors[name] ? (
      <span className="form-error" id={`error-${name}`} role="alert">
        {errors[name]?.message}
      </span>
    ) : null;
  return done ? (
    <div className="booking-success" role="status">
      <Check size={36} />
      <h3>Your demo request is ready.</h3>
      <p>
        This is a demonstration. Your information has not been stored or sent to
        a clinic.
      </p>
      <button
        className="button primary"
        onClick={() => {
          reset();
          setDone(false);
        }}
      >
        Try another request
      </button>
    </div>
  ) : (
    <form
      className="booking-form"
      noValidate
      onSubmit={handleSubmit(() => setDone(true))}
    >
      <div className="form-pair">
        <label>
          Your name
          <input
            {...register("name")}
            aria-label="Your name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "error-name" : undefined}
            placeholder="Full name"
            autoComplete="name"
          />
          {error("name")}
        </label>
        <label>
          Email address
          <input
            {...register("email")}
            aria-label="Email address"
            type="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "error-email" : undefined}
            placeholder="you@example.com"
            autoComplete="email"
          />
          {error("email")}
        </label>
      </div>
      <div className="form-pair">
        <label>
          How can we help?
          <select
            {...register("service")}
            aria-label="How can we help?"
            aria-invalid={Boolean(errors.service)}
            aria-describedby={errors.service ? "error-service" : undefined}
          >
            <option value="">Select a treatment</option>
            {services.map((s) => (
              <option key={s.slug}>{s.name}</option>
            ))}
            <option>First consultation</option>
          </select>
          {error("service")}
        </label>
        <label>
          Preferred date
          <input
            {...register("date")}
            aria-label="Preferred date"
            type="date"
            min={new Date().toLocaleDateString("en-CA")}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? "error-date" : undefined}
          />
          {error("date")}
        </label>
      </div>
      <label>
        Anything you’d like us to know?
        <textarea
          {...register("notes")}
          placeholder="A little about what you’re looking for (optional)"
          rows={3}
        />
        {error("notes")}
      </label>
      <label className="consent">
        <input
          {...register("consent")}
          type="checkbox"
          aria-invalid={Boolean(errors.consent)}
          aria-describedby={errors.consent ? "error-consent" : undefined}
        />{" "}
        I understand this is a demo and no real appointment will be made.
      </label>
      {error("consent")}
      <button className="button primary" type="submit">
        Request a demo appointment
        <ArrowUpRight size={17} />
      </button>
      <p className="fine-print">
        Demo only. No personal information is stored or transmitted.
      </p>
    </form>
  );
}
