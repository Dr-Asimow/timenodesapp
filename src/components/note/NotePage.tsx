import { useEffect, useRef, useState } from "react";
import { loadDayPage, saveDayPage, type PageDoc } from "../../db";
import { NoteEditor } from "./NoteEditor";

export function NotePage({
  userId,
  day,
  dateLabel,
  onClose,
}: {
  userId: string;
  day: string;
  dateLabel: string;
  onClose: () => void;
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
    loadDayPage(day)
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
  }, [day]);

  function scheduleSave() {
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await saveDayPage(
          userId,
          day,
          latest.current.title,
          latest.current.doc ?? {}
        );
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
      await saveDayPage(
        userId,
        day,
        latest.current.title,
        latest.current.doc ?? {}
      );
    } catch {
      /* yoksay */
    }
    onClose();
  }

  return (
    <div className="note-overlay">
      <div className="note-topbar">
        <button className="ghost-btn small" onClick={close}>
          ← Kapat
        </button>
        <span className="note-day muted small">{dateLabel} · Not Defteri</span>
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
  );
}
