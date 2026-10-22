import Image from "next/image";
import SignatureObject from "./SignatureObject";
import { Sparkles } from "lucide-react";
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
export default function Home05() {
  return (
    <>
      <section className="lifestyle-hero">
        <div className="lifestyle-photo">
          <Image
            src="/assets/templates/05.webp"
            fill
            priority
            sizes="(max-width:700px) 100vw, 70vw"
            alt="Generated fictional smile-focused fashion portrait with soft pink satin"
          />
        </div>
        <div className="lifestyle-hero-copy">
          <span className="exp-label">
            Beautiful smiles.
            <br />
            Confident you.
          </span>
          <h1>
            Smile confidently.
            <br />
            Live <em>beautifully.</em>
          </h1>
          <p>
            Aesthetic dentistry with a personal touch.
            <br />
            For a smile that feels naturally you.
          </p>
          <div className="hero-buttons">
            <Action id="05">Book a consultation</Action>
            <Action id="05" to="services" secondary>
              Find your treatment
            </Action>
          </div>
        </div>
        <span className="lifestyle-note">
          <Sparkles size={19} /> Beautifully,
          <br />
          <em>yourself.</em>
        </span>
        <span className="lifestyle-ribbon" />
        <div className="lifestyle-pearl-stage">
          <SignatureObject id="05" />
          <span>
            A little refinement.
            <br />A brighter expression.
          </span>
        </div>
        <small className="exp-image-note">Fictional lifestyle portrait</small>
      </section>
      <Pillars id="05" />
      <section className="lifestyle-intro exp-section scroll-reveal">
        <span className="exp-label">Your smile. Our art.</span>
        <h2>
          A brighter expression
          <br />
          of <em>you.</em>
        </h2>
        <p>
          Small refinements, thoughtful choices, and a fresh perspective on what
          confidence can feel like.
        </p>
        <Action id="05" to="about" secondary>
          Our approach to aesthetics
        </Action>
      </section>
      <Comparison id="05" />
      <Treatments id="05" />
      <Gallery id="05" />
      <Technology id="05" />
      <About id="05" />
      <Team id="05" />
      <Journey id="05" />
      <Testimonials id="05" />
      <FAQ id="05" />
      <Booking id="05" />
      <Contact id="05" />
      <Closing id="05" />
    </>
  );
}
