"use client";

import Image from "next/image";
import { useState } from "react";
import { UserRound } from "lucide-react";
import { personPhotoUrl } from "@/lib/colleges/person-photo";
import "./person-photo.css";

function Photo({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!url || failed)
    return (
      <span
        className="person-photo person-photo-empty"
        role="img"
        aria-label={
          failed ? `Photo unavailable for ${name}` : `No photo for ${name}`
        }
        title={failed ? "Photo unavailable" : "No photo uploaded"}
      >
        <UserRound size={20} aria-hidden="true" />
      </span>
    );
  return (
    <a
      className={`person-photo${loaded ? "" : " is-loading"}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open photo for ${name}`}
      aria-busy={!loaded}
    >
      <Image
        src={url}
        width={44}
        height={52}
        alt={`Photo of ${name}`}
        unoptimized
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </a>
  );
}

export default function PersonPhoto({
  value,
  name,
}: {
  value: unknown;
  name: string;
}) {
  const url = personPhotoUrl(value);
  return <Photo key={url} url={url} name={name} />;
}
