import { useState } from "react";
import type { ReactNode } from "react";

// Etkinlik ikonları — hepsi DOLU (filled), currentColor ile boyanır.
// Yeni ikon eklemek için listeye {key, label, body} eklemek yeterli.
type IconDef = { key: string; label: string; body: ReactNode };

export const HABIT_ICONS: IconDef[] = [
  {
    key: "palette",
    label: "Sanat",
    body: (
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-6.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
    ),
  },
  {
    key: "sport",
    label: "Spor",
    body: (
      <path d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L7 5.57 15.57 14 12 17.57 13.43 19l1.43-1.43 1.43 1.43 2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43z" />
    ),
  },
  {
    key: "book",
    label: "Kitap",
    body: (
      <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7 4h4v8l-2-1.4L7 12V4z" />
    ),
  },
  {
    key: "book2",
    label: "Kitap (açık)",
    body: (
      <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zM12 18.5c-1.45-.85-3.55-1.5-5.5-1.5-1.15 0-2.35.15-3.5.5V7c1.15-.35 2.35-.5 3.5-.5 1.95 0 4.05.4 5.5 1.5v10.5z" />
    ),
  },
  {
    key: "school",
    label: "Eğitim",
    body: (
      <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
    ),
  },
  {
    key: "sword",
    label: "Kılıç",
    body: (
      <>
        <path d="M12 2 13.5 14h-3z" />
        <path d="M7.5 13.7h9v1.6h-9z" />
        <path d="M11 15.3h2v3.7h-2z" />
        <path d="M12 18.7a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z" />
      </>
    ),
  },
  {
    key: "shield",
    label: "Kalkan",
    body: <path d="M12 2 4 5v6c0 5 3.4 9.4 8 10.9 4.6-1.5 8-5.9 8-10.9V5l-8-3z" />,
  },
  {
    key: "music",
    label: "Müzik",
    body: <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />,
  },
  {
    key: "apple",
    label: "Elma",
    body: (
      <>
        <path d="M12 8c-1-1.4-2.6-2-4.2-1.5C5.9 7.1 5 8.9 5 11.2 5 15 7.6 20.5 10.2 20.5c.6 0 1.2-.3 1.8-.3s1.2.3 1.8.3C16.4 20.5 19 15 19 11.2c0-2.3-.9-4.1-2.8-4.7C14.6 6 13 6.6 12 8z" />
        <path d="M12.5 6.8c.1-1.9 1.6-3.3 3.5-3.6-.1 1.9-1.6 3.4-3.5 3.6z" />
      </>
    ),
  },
  {
    key: "flag",
    label: "Bayrak",
    body: (
      <path d="M5.2 3a1 1 0 0 0-1 1v17a1 1 0 0 0 2 0v-6h12.3a.6.6 0 0 0 .5-.92L16.7 10l2.3-4.08A.6.6 0 0 0 18.5 5H6.2V4a1 1 0 0 0-1-1z" />
    ),
  },
  {
    key: "code",
    label: "Kod",
    body: (
      <path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
    ),
  },
  {
    key: "work",
    label: "İş",
    body: (
      <path d="M20 6h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-6 0h-4V4h4v2z" />
    ),
  },
  {
    key: "heart",
    label: "Kalp",
    body: (
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    ),
  },
  {
    key: "star",
    label: "Yıldız",
    body: (
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    ),
  },
  {
    key: "camera",
    label: "Fotoğraf",
    body: (
      <path d="M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
    ),
  },
  {
    key: "pencil",
    label: "Yazı",
    body: (
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    ),
  },
];

const ICON_MAP: Record<string, ReactNode> = Object.fromEntries(
  HABIT_ICONS.map((i) => [i.key, i.body])
);

// Tek bir ikonu çizer. Bilinmeyen anahtar için null döner (renk noktasına düşülür).
export function HabitIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const body = ICON_MAP[name];
  if (!body) return null;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}

// İkon seçici: mevcut ikonu (yoksa renk noktasını) gösteren buton; tıklayınca
// tüm ikonların olduğu popup açılır. HabitColorPicker ile aynı desende.
export function HabitIconPicker({
  icon,
  color,
  onChange,
}: {
  icon: string | null;
  color: string | null;
  onChange: (icon: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const tint = color || "var(--accent)";
  return (
    <span className="nt-color-wrap">
      <button
        type="button"
        className="habit-icon-btn"
        title="Etkinlik ikonu"
        style={{ color: tint }}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        {icon ? (
          <HabitIcon name={icon} className="habit-icon" />
        ) : (
          <span className="habit-dot" style={{ background: tint }} />
        )}
      </button>
      {open ? (
        <div className="nt-icon-pop" onMouseLeave={() => setOpen(false)}>
          <button
            type="button"
            className={`nt-icon-cell none ${icon ? "" : "on"}`}
            title="İkon yok (renk noktası)"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(null);
              setOpen(false);
            }}
          >
            ⌀
          </button>
          {HABIT_ICONS.map((ic) => (
            <button
              key={ic.key}
              type="button"
              className={`nt-icon-cell ${icon === ic.key ? "on" : ""}`}
              title={ic.label}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(ic.key);
                setOpen(false);
              }}
            >
              <HabitIcon name={ic.key} className="habit-icon" />
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
