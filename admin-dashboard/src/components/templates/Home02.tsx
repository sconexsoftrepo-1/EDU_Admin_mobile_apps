import Image from "next/image";
import { ArrowDown, ScanLine, Orbit, Layers2, ShieldCheck } from "lucide-react";
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
} from "./Blocks";
export default function Home02() {
  return (
    <>
      <section className="cinema-hero">
        <div className="cinema-atmosphere" />
        <Image
          src="/assets/templates/02.webp"
          fill
          priority
          sizes="100vw"
          alt="Generated cinematic dental implant with luminous violet orbital rings"
          className="cinema-hero-image"
        />
        <div className="cinema-hero-copy">
          <span className="exp-label">Precision. Comfort. Confidence.</span>
          <h1>
            Advanced
            <br />
            dental care.
            <br />
            <em>A healthier you.</em>
          </h1>
          <p>
            Worlds of possibility.
            <br />
            One remarkably personal experience.
          </p>
          <div className="hero-buttons">
            <Action id="02" />
            <Action id="02" to="services" secondary>
              Explore treatments
            </Action>
          </div>
          <div className="cinema-footnote">
            <span />
            <p>A new dimension of dentistry.</p>
          </div>
        </div>
        <div className="cinema-holo holo-one">
          <ScanLine size={20} />
          <span>
            Digital perspective<small>A clearer view of your care</small>
          </span>
        </div>
        <div className="cinema-holo holo-two">
          <Layers2 size={20} />
          <span>
            Precision planning<small>Designed around you</small>
          </span>
        </div>
        <a href="#technology" className="hero-explore">
          Explore the next dimension <ArrowDown size={15} />
        </a>
        <small className="exp-image-note">
          Illustrative dental visualization
        </small>
      </section>
      <Pillars id="02" />
      <Treatments id="02" />
      <Technology id="02" />
      <About id="02" />
      <section className="cinema-feature exp-section scroll-reveal">
        <span className="exp-label">A different kind of focus</span>
        <h2>
          Beyond the surface.
          <br />
          Closer to you.
        </h2>
        <p>
          Precision is only meaningful when it makes room for the person behind
          the smile.
        </p>
        <div>
          <ShieldCheck size={29} />
          <Orbit size={29} />
          <ScanLine size={29} />
        </div>
        <Action id="02" to="about" secondary>
          Discover our approach
        </Action>
      </section>
      <Journey id="02" />
      <Team id="02" />
      <Comparison id="02" />
      <Testimonials id="02" />
      <Gallery id="02" />
      <FAQ id="02" />
      <Booking id="02" />
      <Contact id="02" />
      <Closing id="02" />
    </>
  );
}
