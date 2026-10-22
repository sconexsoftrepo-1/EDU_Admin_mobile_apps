import Image from "next/image";
import { brandConfig } from "./config/brandConfig";
export function BrandStar({ className = "" }: { className?: string }) {
  return (
    <Image
      unoptimized
      className={`brand-star ${className}`}
      src="/assets/brand/logos/brand-star.svg"
      width={64}
      height={64}
      alt=""
    />
  );
}
export function BrandWordmark() {
  return <span className="brand-wordmark">{brandConfig.wordmark}</span>;
}
export default function BrandLogo({ tagline = false }: { tagline?: boolean }) {
  return (
    <span className="cosmic-brand-logo">
      <BrandStar />
      <span>
        <BrandWordmark />
        {tagline && <small>{brandConfig.tagline}</small>}
      </span>
    </span>
  );
}
