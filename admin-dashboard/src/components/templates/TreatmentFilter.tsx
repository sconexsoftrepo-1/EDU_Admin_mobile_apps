"use client";
import { Children, useState } from "react";
import { Search, X } from "lucide-react";
export default function TreatmentFilter({
  children,
  labels,
  searchable = false,
  className = "exp-services",
}: {
  children: React.ReactNode;
  labels: string[];
  searchable?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const cards = Children.toArray(children);
  const results = cards.filter((_, i) =>
    labels[i]?.toLowerCase().includes(query.toLowerCase().trim()),
  );
  return (
    <>
      {searchable && (
        <div className="treatment-filter">
          <label>
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a treatment"
              aria-label="Find a treatment"
            />
          </label>
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear treatment search"
            >
              <X size={16} />
            </button>
          )}
          <span aria-live="polite">
            {results.length} treatment{results.length === 1 ? "" : "s"}
          </span>
        </div>
      )}
      <div className={className}>{results}</div>
      {searchable && results.length === 0 && (
        <div className="treatment-empty" role="status">
          <h3>No treatments match that search.</h3>
          <p>Try a broader term, or clear your search to see all options.</p>
          <button onClick={() => setQuery("")}>Show all treatments</button>
        </div>
      )}
    </>
  );
}
