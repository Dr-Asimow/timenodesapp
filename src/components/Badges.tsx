import { useState } from "react";

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  const d = dir === "left" ? "M13 4l-6 6 6 6" : "M7 4l6 6-6 6";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export type BadgeDef = {
  id: string;
  icon: string;
  label: string;
  description: string;
  color: string;
};

export const BADGES: BadgeDef[] = [
  {
    id: "tester",
    icon: "t",
    label: "Tester",
    description:
      "Timenodes'un geliştirilmesinde katkıda bulunduğunuz için teşekkürler.",
    color: "var(--accent)",
  },
  {
    id: "founder",
    icon: "f",
    label: "Founder",
    description:
      "Timenodes'u baştan kuran ekibin bir parçası olduğunuz için teşekkürler.",
    color: "#f0c000",
  },
];

export function BadgeRow() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="badge-section">
      <h3 className="badge-section-title">Rozetler</h3>
      <div className="badge-row">
        {BADGES.map((b, i) => (
          <button
            key={b.id}
            className="badge-pill"
            style={{ "--badge-color": b.color } as React.CSSProperties}
            onClick={() => setOpen(i)}
            title={b.label}
          >
            <span className="badge-pill-ic">{b.icon}</span>
            <span className="badge-pill-label">{b.label}</span>
          </button>
        ))}
      </div>

      {open !== null ? (
        <div className="badge-popup-overlay" onClick={() => setOpen(null)}>
          <div
            className="badge-popup-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            {BADGES.length > 1 ? (
              <button
                className="badge-popup-arrow"
                onClick={() =>
                  setOpen((open - 1 + BADGES.length) % BADGES.length)
                }
                title="Önceki rozet"
              >
                <ChevronIcon dir="left" />
              </button>
            ) : null}
            <div
              className="badge-popup"
              style={{ "--badge-color": BADGES[open].color } as React.CSSProperties}
            >
              <button
                className="badge-popup-close"
                onClick={() => setOpen(null)}
                title="Kapat"
              >
                ×
              </button>
              <span className="badge-popup-ic">{BADGES[open].icon}</span>
              <div className="badge-popup-name">{BADGES[open].label}</div>
              <p className="badge-popup-desc">{BADGES[open].description}</p>
            </div>
            {BADGES.length > 1 ? (
              <button
                className="badge-popup-arrow"
                onClick={() => setOpen((open + 1) % BADGES.length)}
                title="Sonraki rozet"
              >
                <ChevronIcon dir="right" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
