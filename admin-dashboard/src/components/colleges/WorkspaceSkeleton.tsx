export default function WorkspaceSkeleton({
  label = "Loading screen data",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`erp-skeleton ${compact ? "is-compact" : ""}`}
      role="status"
      aria-label={label}
    >
      <span className="erp-skeleton-label">{label}</span>
      <div className="erp-skeleton-cards">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <i />
            <b />
          </div>
        ))}
      </div>
      <div className="erp-skeleton-table">
        {Array.from({ length: compact ? 4 : 6 }, (_, i) => (
          <div key={i}>
            <i />
            <i />
            <i />
            <i />
          </div>
        ))}
      </div>
    </div>
  );
}
