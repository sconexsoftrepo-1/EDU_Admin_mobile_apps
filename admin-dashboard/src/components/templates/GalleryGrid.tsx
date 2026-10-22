"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Expand, Sparkles } from "lucide-react";
import { experiences, type TemplateId } from "@/data/experiences";
export default function GalleryGrid({ id }: { id: TemplateId | "01" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const images = [
    {
      src: "/assets/templates/interior.webp",
      caption: "A space to feel at ease",
      alt: "Generated contemporary fictional dental clinic interior",
    },
    {
      src: id === "01" ? "/assets/hero.webp" : experiences[id].hero,
      caption:
        id === "03"
          ? "Care for every generation"
          : id === "05"
            ? "Your own expression"
            : "A new perspective on care",
      alt: `Generated illustrative ${id === "01" ? "Clean & Modern" : experiences[id].label} scene`,
    },
    {
      src: id === "01" ? "/assets/team.webp" : "/assets/hero.webp",
      caption: "Time for a more personal experience",
      alt: "Generated fictional dentist and adult patient",
    },
  ];
  function open(i: number) {
    setIndex(i);
    dialog.current?.showModal();
  }
  return (
    <>
      <div className="gallery-composition">
        {images.map((img, i) => (
          <button
            className={`gallery-tile gallery-tile-${i}`}
            key={img.src}
            onClick={() => open(i)}
            aria-label={`View ${img.caption}`}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width:700px) 100vw, 55vw"
            />
            <span>
              {img.caption}
              <Expand size={15} />
            </span>
          </button>
        ))}
        <div className="gallery-note">
          <Sparkles size={23} />
          <p>
            Thoughtful spaces.
            <br />
            Personal experiences.
          </p>
          <small>Generated illustrative environments & imagery</small>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="gallery-lightbox"
        aria-label="Illustrative clinic gallery"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setIndex((index + 1) % images.length);
          if (e.key === "ArrowLeft")
            setIndex((index + images.length - 1) % images.length);
        }}
      >
        <button
          className="lightbox-close"
          onClick={() => dialog.current?.close()}
          aria-label="Close gallery"
        >
          <X size={22} />
        </button>
        <div className="lightbox-image">
          <Image
            src={images[index].src}
            alt={images[index].alt}
            fill
            sizes="90vw"
          />
        </div>
        <div className="lightbox-controls">
          <button
            onClick={() =>
              setIndex((index + images.length - 1) % images.length)
            }
            aria-label="Previous gallery image"
          >
            <ChevronLeft />
          </button>
          <p>
            {images[index].caption}
            <small>
              Generated illustration · {index + 1} / {images.length}
            </small>
          </p>
          <button
            onClick={() => setIndex((index + 1) % images.length)}
            aria-label="Next gallery image"
          >
            <ChevronRight />
          </button>
        </div>
      </dialog>
    </>
  );
}
