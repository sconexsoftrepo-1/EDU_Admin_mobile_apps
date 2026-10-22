import Image from "next/image";
import { Heart, Sparkles } from "lucide-react";
import DentalViewer from "../three/DentalViewer";
import {
  Action,
  Pillars,
  Treatments,
  About,
  Technology,
  Team,
  Journey,
  Comparison,
  Gallery,
  Testimonials,
  FAQ,
  Booking,
  Contact,
  Closing,
  FamilyFeature,
} from "./Blocks";
export default function Home03() {
  return (
    <>
      <section className="family-hero">
        <div className="family-hero-copy">
          <span className="exp-label">Gentle care for every generation</span>
          <h1>
            Healthy smiles.
            <br />
            <span>Happy</span>
            <br />
            families.
          </h1>
          <p>
            Little teeth. Big milestones.
            <br />A friendly place for every family smile.
          </p>
          <div className="hero-buttons">
            <Action id="03" />
            <Action id="03" to="services" secondary>
              Our services
            </Action>
          </div>
          <span className="family-hero-promise">
            <Heart size={16} />A little reassurance goes a long way.
          </span>
        </div>
        <div className="family-hero-portrait">
          <Image
            src="/assets/templates/03.webp"
            fill
            priority
            sizes="(max-width:700px) 100vw, 60vw"
            alt="Generated fictional family smiling together"
          />
          <div className="family-heart">
            <Heart size={58} strokeWidth={1} />
            <Sparkles size={18} />
          </div>
          <span className="family-handwriting">
            Care for
            <br />
            every smile.
          </span>
          <div className="family-mascot">
            <DentalViewer id="03" compact />
          </div>
          <small className="exp-image-note">
            Fictional family · Generated imagery
          </small>
        </div>
      </section>
      <Pillars id="03" />
      <FamilyFeature />
      <Treatments id="03" />
      <About id="03" />
      <Team id="03" />
      <Journey id="03" />
      <Technology id="03" />
      <Comparison id="03" />
      <Gallery id="03" />
      <Testimonials id="03" />
      <FAQ id="03" />
      <Booking id="03" />
      <Contact id="03" />
      <Closing id="03" />
    </>
  );
}
