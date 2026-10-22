import Link from "next/link";
export default function NotFound() {
  return (
    <main className="section inner-hero">
      <span className="eyebrow">Web Universe</span>
      <h1>Let’s find your way back.</h1>
      <p>This page isn’t part of the collection.</p>
      <Link className="button primary" href="/">
        Explore the templates
      </Link>
    </main>
  );
}
