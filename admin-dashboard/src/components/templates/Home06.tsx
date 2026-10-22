import Image from "next/image";
import { ScanLine, Layers2, ArrowUpRight, Activity } from "lucide-react";
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
export default function Home06() {
  return (
    <>
      <section className="digital-hero">
        <div className="digital-grid" />
        <div className="digital-hero-image">
          <Image
            src="/assets/templates/06.webp"
            fill
            priority
            sizes="(max-width:700px) 100vw, 65vw"
            alt="Generated holographic tooth above a digital scanning platform"
          />
        </div>
        <div className="digital-hero-copy">
          <span className="digital-status">
            <span /> The next perspective in dental care
          </span>
          <h1>
            Technology
            <br />
            meets
            <br />
            <em>your smile.</em>
          </h1>
          <p>
            Digital insight. Human understanding.
            <br />A more connected approach to your care.
          </p>
          <div className="hero-buttons">
            <Action id="06" />
            <a className="digital-model-link" href="#technology">
              Inspect the 3D model
              <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="digital-data">
            <div>
              <ScanLine size={18} />
              <span>
                3D perspective<small>See the bigger picture</small>
              </span>
            </div>
            <div>
              <Activity size={18} />
              <span>
                Personal planning<small>Understand your next step</small>
              </span>
            </div>
          </div>
        </div>
        <a href="#technology" className="diagnostic-chip chip-top">
          <ScanLine size={18} />
          <span>
            Surface detail<small>Explore enamel</small>
          </span>
        </a>
        <a href="#technology" className="diagnostic-chip chip-bottom">
          <Layers2 size={18} />
          <span>
            Inside the tooth<small>Explore the anatomy</small>
          </span>
        </a>
        <span className="digital-scan-line" />
        <small className="exp-image-note">
          Illustrative digital visualization
        </small>
      </section>
      <Pillars id="06" />
      <Technology id="06" />
      <Treatments id="06" />
      <Journey id="06" />
      <About id="06" />
      <section className="digital-manifesto exp-section scroll-reveal">
        <span className="exp-label">A more human kind of progress</span>
        <h2>
          Better information.
          <br />
          Better conversations.
        </h2>
        <p>
          Technology opens a door. A thoughtful team helps you understand what’s
          on the other side.
        </p>
        <Action id="06" to="technology" secondary>
          Connect the details
        </Action>
      </section>
      <Team id="06" />
      <Comparison id="06" />
      <Gallery id="06" />
      <Testimonials id="06" />
      <FAQ id="06" />
      <Booking id="06" />
      <Contact id="06" />
      <Closing id="06" />
    </>
  );
}
