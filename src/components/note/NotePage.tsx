import { useEffect, useRef, useState } from "react";
import type { Page, PageDoc } from "../../db";
import { NoteEditor } from "./NoteEditor";

export function NotePage({
  pageKey,
  headerLabel,
  userId,
  load,
  save,
  onClose,
  accentColor,
  onAccentColorChange,
}: {
  // Sayfayı yeniden yüklemeyi tetikleyen anahtar (gün ISO'su ya da habit id)
  pageKey: string;
  // Üst çubukta gösterilen etiket (ör. "10 Haz · Günlük" veya "Japonca · Etkinlik")
  headerLabel: string;
  // Görsel yükleme için oturum sahibinin id'si
  userId: string;
  load: () => Promise<Page | null>;
  save: (title: string, content: PageDoc) => Promise<void>;
  onClose: () => void;
  // Verilirse üst çubukta etkinlik renk seçici gösterilir (sadece etkinlik sayfalarında)
  accentColor?: string | null;
  onAccentColorChange?: (color: string | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [doc, setDoc] = useState<PageDoc | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  // İçinde tutulan en güncel değerler (debounce kaydı için)
  const latest = useRef({ title: "", doc: null as PageDoc | null });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    load()
      .then((p) => {
        if (cancel) return;
        setTitle(p?.title ?? "");
        setDoc(p?.content ?? null);
        latest.current = { title: p?.title ?? "", doc: p?.content ?? null };
        setLoading(false);
      })
      .catch(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [pageKey]);

  function scheduleSave() {
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await save(latest.current.title, latest.current.doc ?? {});
        setStatus("saved");
      } catch {
        setStatus("idle");
      }
    }, 700);
  }

  // Kapanırken bekleyen kaydı hemen yaz
  async function close() {
    if (timer.current) clearTimeout(timer.current);
    try {
      await save(latest.current.title, latest.current.doc ?? {});
    } catch {
      /* yoksay */
    }
    onClose();
  }

  return (
    <div
      className="note-overlay"
      onMouseDown={(e) => {
        // Yalnızca karartılmış alana (modalın dışına) tıklayınca kapat
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="note-modal">
      <div className="note-topbar">
        <button className="ghost-btn small" onClick={close}>
          ← Kapat
        </button>
        <span className="note-day muted small">{headerLabel}</span>
        {onAccentColorChange ? (
          <HabitColorPicker
            color={accentColor ?? null}
            onChange={onAccentColorChange}
          />
        ) : null}
        <span className="note-status muted small">
          {status === "saving"
            ? "Kaydediliyor…"
            : status === "saved"
            ? "Kaydedildi ✓"
            : ""}
        </span>
      </div>

      <div className="note-scroll">
        <div className="note-doc">
          {loading ? (
            <p className="muted small">Yükleniyor…</p>
          ) : (
            <>
              <input
                className="note-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  latest.current.title = e.target.value;
                  scheduleSave();
                }}
                placeholder="Başlıksız"
              />
              <NoteEditor
                content={doc}
                userId={userId}
                onChange={(d) => {
                  latest.current.doc = d;
                  scheduleSave();
                }}
              />
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

const HABIT_COLORS = [
  { name: "Varsayılan", v: null },
  { name: "Yeşil", v: "#39d353" },
  { name: "Mavi", v: "#6cb0ff" },
  { name: "Mor", v: "#c084fc" },
  { name: "Turuncu", v: "#f0a020" },
  { name: "Sarı", v: "#f0c000" },
  { name: "Kırmızı", v: "#ff6b6b" },
  { name: "Pembe", v: "#f472b6" },
  { name: "Camgöbeği", v: "#2dd4bf" },
  { name: "Gri", v: "#9aa4b2" },
];

function HabitColorPicker({
  color,
  onChange,
}: {
  color: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="nt-color-wrap">
      <button
        type="button"
        className="habit-color-btn"
        title="Etkinlik rengi"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        <span
          className="habit-dot"
          style={{ background: color || "var(--accent)" }}
        />
      </button>
      {open ? (
        <div className="nt-color-pop" onMouseLeave={() => setOpen(false)}>
          {HABIT_COLORS.map((col) => (
            <button
              key={col.name}
              type="button"
              className="nt-swatch"
              title={col.name}
              style={{ background: col.v ?? "transparent" }}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(col.v);
                setOpen(false);
              }}
            >
              {col.v ? "" : "⌀"}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
