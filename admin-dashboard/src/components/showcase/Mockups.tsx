import Image from "next/image";
export function BrowserMockup({
  src,
  label,
  priority = false,
  className = "",
}: {
  src: string;
  label: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`showcase-browser ${className}`}>
      <div className="showcase-browser-chrome" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>{label}</span>
        <b>↗</b>
      </div>
      <div className="showcase-browser-screen">
        <Image
          unoptimized
          src={src}
          alt={`${label} desktop website preview`}
          fill
          sizes="(max-width:700px) 94vw, 75vw"
          priority={priority}
        />
      </div>
    </div>
  );
}
export function MobileMockup({
  src,
  label,
  className = "",
}: {
  src: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={`showcase-phone ${className}`}>
      <div className="showcase-phone-island" aria-hidden="true" />
      <Image
        unoptimized
        src={src}
        alt={`${label} mobile website preview`}
        fill
        sizes="(max-width:600px) 240px, 270px"
      />
    </div>
  );
}
