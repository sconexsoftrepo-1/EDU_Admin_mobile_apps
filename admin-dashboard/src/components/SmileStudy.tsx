"use client";
import { useState } from "react";
export default function SmileStudy() {
  const [value, setValue] = useState(50);
  return (
    <section className="section smile-study">
      <div>
        <span className="eyebrow">Explore the possibilities</span>
        <h2>
          A little change.
          <br />A fresh perspective.
        </h2>
        <p>
          Move the slider to explore an illustrative shade comparison. A
          conversation with your dentist can help you understand what’s possible
          for your smile.
        </p>
        <small>
          Educational illustration. Not a patient result or treatment promise.
        </small>
      </div>
      <div className="comparison">
        <div className="smile-illustration">
          <div className="teeth-row">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
        <div
          className="comparison-bright"
          style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}
        >
          <div className="smile-illustration">
            <div className="teeth-row">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
          </div>
        </div>
        <div className="comparison-divider" style={{ left: `${value}%` }}>
          <span>↔</span>
        </div>
        <div className="comparison-labels">
          <span>Brighter shade</span>
          <span>Natural shade</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-label="Compare illustrative tooth shades"
        />
        <span className="comparison-caption">Drag to compare</span>
      </div>
    </section>
  );
}
