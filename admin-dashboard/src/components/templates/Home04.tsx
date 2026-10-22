import Image from "next/image";
import { ArrowDown, Diamond } from "lucide-react";
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
} from "./Blocks";
export default function Home04() {
  return (
    <>
      <section className="luxury-hero">
        <div className="luxury-portrait">
          <Image
            src="/assets/templates/04.webp"
            fill
            priority
            sizes="(max-width:700px) 100vw, 65vw"
            alt="Generated fictional smile portrait with warm editorial lighting"
          />
        </div>
        <div className="luxury-hero-copy">
          <span className="exp-label">
            Your smile.
            <br />
            Our expertise.
          </span>
          <h1>
            Modern
            <br />
            dentistry.
            <br />
            <em>Refined.</em>
          </h1>
          <p>
            The art of considered care.
            <br />
            An experience, entirely your own.
          </p>
          <Action id="04">Reserve a consultation</Action>
        </div>
        <div className="luxury-sculpture">
          <DentalViewer id="04" compact />
          <span>Precision, in every detail.</span>
        </div>
        <a className="luxury-discover" href="#treatments">
          <span>Discover the practice</span>
          <ArrowDown size={16} />
        </a>
        <small className="exp-image-note">
          Fictional portrait · Editorial illustration
        </small>
      </section>
      <Pillars id="04" />
      <About id="04" />
      <Treatments id="04" />
      <section className="luxury-statement exp-section scroll-reveal">
        <Diamond size={26} />
        <h2>
          Nothing unnecessary.
          <br />
          Everything considered.
        </h2>
        <p>
          A little time. A little understanding. A profound difference in how
          care feels.
        </p>
      </section>
      <Technology id="04" />
      <Team id="04" />
      <Comparison id="04" />
      <Journey id="04" />
      <Gallery id="04" />
      <Testimonials id="04" />
      <FAQ id="04" />
      <Booking id="04" />
      <Contact id="04" />
      <Closing id="04" />
    </>
  );
}
