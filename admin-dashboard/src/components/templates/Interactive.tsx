"use client";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Heart,
  Smile,
  Users,
  Check,
  ArrowRight,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { faqs } from "@/data/clinic";
import type { TemplateId } from "@/data/experiences";
export function FamilyCare() {
  const [age, setAge] = useState(0);
  const options = [
    {
      title: "Little smiles",
      age: "Children",
      text: "A gentle introduction to the dentist, preventive care, and good habits that grow with them.",
      icon: Smile,
    },
    {
      title: "Everyday confidence",
      age: "Adults",
      text: "Routine care, restorative options, and a plan that works around your life.",
      icon: Heart,
    },
    {
      title: "Care that continues",
      age: "Seniors",
      text: "Comfortable, considered support for changing smiles and long-term oral health.",
      icon: Users,
    },
  ];
  return (
    <div className="family-selector">
      <div className="age-tabs" role="tablist" aria-label="Care for every age">
        {options.map((o, i) => (
          <button
            key={o.age}
            id={`age-tab-${i}`}
            role="tab"
            aria-selected={age === i}
            aria-controls="age-content"
            tabIndex={age === i ? 0 : -1}
            onClick={() => setAge(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = (i + (e.key === "ArrowRight" ? 1 : -1) + 3) % 3;
                setAge(next);
                document.getElementById(`age-tab-${next}`)?.focus();
              }
            }}
          >
            <o.icon size={25} />
            <strong>{o.age}</strong>
          </button>
        ))}
      </div>
      <div
        className="age-content"
        id="age-content"
        role="tabpanel"
        aria-labelledby={`age-tab-${age}`}
      >
        <span>A comfortable experience for all ages</span>
        <h3>{options[age].title}</h3>
        <p>{options[age].text}</p>
      </div>
    </div>
  );
}
export function Questions() {
  const [open, setOpen] = useState(0);
  return (
    <div className="experience-faq">
      {faqs.map((f, i) => (
        <div key={f.q}>
          <h3>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
              aria-controls={`answer-${i}`}
            >
              {f.q}
              {open === i ? <Minus size={18} /> : <Plus size={18} />}
            </button>
          </h3>
          <div id={`answer-${i}`} hidden={open !== i}>
            <p>{f.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
export function Feedback({ id }: { id: TemplateId }) {
  const [emblaRef, api] = useEmblaCarousel({ loop: true });
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!api) return;
    const update = () => setIndex(api.selectedScrollSnap());
    api.on("select", update);
    return () => {
      api.off("select", update);
    };
  }, [api]);
  const quotes =
    id === "03"
      ? [
          "“A place for little questions, big feelings, and every family smile.”",
          "“A warm welcome makes the first step feel a little easier.”",
          "“Growing good habits together, one visit at a time.”",
        ]
      : id === "04"
        ? [
            "“Every detail considered. Every conversation unhurried.”",
            "“A personal approach to a smile that feels entirely your own.”",
            "“The quiet confidence of feeling understood.”",
          ]
        : id === "05"
          ? [
              "“More confidence. More expression. A little more me.”",
              "“A thoughtful approach to a smile that feels natural.”",
              "“A new chapter, with room to be yourself.”",
            ]
          : [
              "“Clear conversations. Considered care. A better perspective.”",
              "“The comfort of understanding every step of your care.”",
              "“A thoughtful experience, from the first hello.”",
            ];
  return (
    <div
      className="feedback-carousel"
      aria-roledescription="carousel"
      aria-label="Sample feedback"
    >
      <div className="feedback-viewport" ref={emblaRef}>
        <div className="feedback-track">
          {quotes.map((q, i) => (
            <figure
              key={q}
              className="feedback-slide"
              aria-label={`Sample ${i + 1} of 3`}
            >
              <span aria-hidden="true">“</span>
              <blockquote>{q}</blockquote>
              <figcaption>Sample feedback · Fictional demonstration</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="carousel-controls">
        <button
          aria-label="Previous sample feedback"
          onClick={() => api?.scrollPrev()}
        >
          <ChevronLeft size={18} />
        </button>
        <span aria-live="polite">0{index + 1} / 03</span>
        <button
          aria-label="Next sample feedback"
          onClick={() => api?.scrollNext()}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export function DigitalTimeline() {
  const [step, setStep] = useState(0);
  const stages = [
    {
      label: "Capture",
      title: "Start with a clearer picture.",
      copy: "Explore how a digital scan can create a three-dimensional view of a smile.",
    },
    {
      label: "Understand",
      title: "Turn information into understanding.",
      copy: "See how digital views can support a conversation about your options.",
    },
    {
      label: "Plan",
      title: "Make room for a personal plan.",
      copy: "Connect the details with your goals and talk through the next step.",
    },
  ];
  return (
    <div className="digital-timeline">
      <div
        className="timeline-tabs"
        role="tablist"
        aria-label="Digital care workflow"
      >
        {stages.map((s, i) => (
          <button
            role="tab"
            id={`digital-tab-${i}`}
            aria-controls="digital-panel"
            aria-selected={step === i}
            key={s.label}
            tabIndex={step === i ? 0 : -1}
            onClick={() => setStep(i)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                const n = (i + (e.key === "ArrowRight" ? 1 : -1) + 3) % 3;
                setStep(n);
                document.getElementById(`digital-tab-${n}`)?.focus();
              }
            }}
          >
            <span>0{i + 1}</span>
            {s.label}
            {step > i && <Check size={13} />}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="digital-panel"
        aria-labelledby={`digital-tab-${step}`}
      >
        <h3>{stages[step].title}</h3>
        <p>{stages[step].copy}</p>
        <button className="next-stage" onClick={() => setStep((step + 1) % 3)}>
          Next stage <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
