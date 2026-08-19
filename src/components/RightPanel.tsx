import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Goal, Reminder, TodoItem, TodoDifficulty } from "../types";
import type { TodoExtra } from "../db";
import type { AmbientId } from "../ambient";
import type { YouTubeApi } from "../useYouTube";
import type { MusicPlaylistsApi } from "../useMusicPlaylists";
import { MusicCard } from "./AmbientPlayer";
import { Collapse } from "./Collapse";
import { IconBell, IconCheck } from "./Icons";

type RightTab = "hatirlatici" | "todo";

function fmtCountdown(targetAt: string): { label: string; expired: boolean } {
  const diff = new Date(targetAt).getTime() - Date.now();
  if (diff <= 0) return { label: "Süresi doldu", expired: true };
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return { label: `${d}g ${h}sa`, expired: false };
  if (h > 0) return { label: `${h}sa ${m}dk`, expired: false };
  return { label: `${m}dk`, expired: false };
}

export function RightPanel({
  todos,
  overdueTodos,
  todayISO,
  goals,
  reminders,
  onAddGoal,
  onDeleteGoal,
  onAddReminder,
  onDeleteReminder,
  onAddTodo,
  onToggleTodo,
  onDeleteItem,
  onMoveOverdueToToday,
  onCompleteOverdue,
  onDeleteOverdue,
  yt,
  favs,
  ambientId,
  ambientPlaying,
  ambientVol,
  onToggleAmbient,
  onAmbientVol,
}: {
  todos: TodoItem[];
  // Günü geçmiş, yapılmamış to-do'lar ("Geciken" bölümü)
  overdueTodos: TodoItem[];
  todayISO: string;
  goals: Goal[];
  reminders: Reminder[];
  onAddGoal: (text: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddReminder: (title: string, targetAt: string, description?: string) => void;
  onDeleteReminder: (id: string) => void;
  onAddTodo: (title: string, extra?: TodoExtra) => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onDeleteItem: (id: string) => void;
  onMoveOverdueToToday: (id: string) => void;
  onCompleteOverdue: (id: string) => void;
  onDeleteOverdue: (id: string) => void;
  yt: YouTubeApi;
  favs: MusicPlaylistsApi;
  ambientId: AmbientId | null;
  ambientPlaying: boolean;
  ambientVol: number;
  onToggleAmbient: (id: AmbientId) => void;
  onAmbientVol: (v: number) => void;
}) {
  const [tab, setTab] = useState<RightTab>("hatirlatici");

  return (
    <aside className="right-panel">
      {/* Üst sekmeli kart */}
      <div className="side-card right-tabs-card">
        <div className="rtab-btns">
          <button
            className={`rtab-btn${tab === "hatirlatici" ? " active" : ""}`}
            onClick={() => setTab("hatirlatici")}
            title="Hatırlatıcılar"
          >
            <IconBell size={14} /> Hatırlat
          </button>
          <button
            className={`rtab-btn${tab === "todo" ? " active" : ""}`}
            onClick={() => setTab("todo")}
            title="Yapılacaklar"
          >
            <IconCheck size={14} /> To-do
          </button>
        </div>

        <div className="rtab-content">
          {tab === "hatirlatici" ? (
            <ReminderTab
              reminders={reminders}
              onAdd={onAddReminder}
              onDelete={onDeleteReminder}
            />
          ) : (
            <TodoTab
              todos={todos}
              overdueTodos={overdueTodos}
              todayISO={todayISO}
              onAddTodo={onAddTodo}
              onToggle={onToggleTodo}
              onDelete={onDeleteItem}
              onMoveOverdueToToday={onMoveOverdueToToday}
              onCompleteOverdue={onCompleteOverdue}
              onDeleteOverdue={onDeleteOverdue}
            />
          )}
        </div>
      </div>

      {/* Müzik player kartı */}
      <MusicCard
        yt={yt}
        favs={favs}
        current={ambientId}
        playing={ambientPlaying}
        volume={ambientVol}
        onToggle={onToggleAmbient}
        onVolume={onAmbientVol}
      />
    </aside>
  );
}

// --- Hatırlatıcı sekmesi ---

function ReminderTab({
  reminders,
  onAdd,
  onDelete,
}: {
  reminders: Reminder[];
  onAdd: (title: string, targetAt: string, description?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((v) => v + 1), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rtab-inner">
      {reminders.length === 0 ? (
        <p className="rtab-empty muted small">Henüz hatırlatıcı eklenmemiş.</p>
      ) : (
        <ul className="rtab-list">
          {reminders.map((r) => {
            const { label, expired } = fmtCountdown(r.target_at);
            return (
              <li key={r.id} className={`rtab-item reminder-item${expired ? " expired" : ""}`}>
                <div className="reminder-info">
                  <span className="rtab-item-text">{r.title}</span>
                  {r.description ? (
                    <span className="reminder-desc muted small">{r.description}</span>
                  ) : null}
                  <span className={`reminder-countdown small${expired ? " expired" : ""}`}>
                    {expired ? "⏰ " : "⏳ "}{label}
                  </span>
                </div>
                <button className="rtab-del-btn" onClick={() => onDelete(r.id)}>×</button>
              </li>
            );
          })}
        </ul>
      )}
      <button className="rtab-agenda-btn" onClick={() => setShowPopup(true)}>
        + Hatırlatıcı ekle
      </button>
      {showPopup ? (
        <ReminderPopup
          onAdd={(title, targetAt, desc) => {
            onAdd(title, targetAt, desc);
            setShowPopup(false);
          }}
          onClose={() => setShowPopup(false)}
        />
      ) : null}
    </div>
  );
}

// --- Hatırlatıcı ekleme popup'ı ---

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const DOW = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"];

function MiniCal({
  value,
  onPick,
  minISO,
}: {
  value: string;
  onPick: (iso: string) => void;
  // Bu tarihten öncesi seçilemez (geçmişe hatırlatıcı engeli)
  minISO?: string;
}) {
  const today = new Date();
  const init = value ? new Date(value + "T00:00:00") : today;
  const [year, setYear] = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth());

  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function prev() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }
  function iso(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return (
    <div className="mc">
      <div className="mc-head">
        <button type="button" className="mc-nav" onClick={prev}>‹</button>
        <span className="mc-title">{MONTH_NAMES[month]} {year}</span>
        <button type="button" className="mc-nav" onClick={next}>›</button>
      </div>
      <div className="mc-dow">
        {DOW.map((d) => <span key={d} className="mc-dow-cell">{d}</span>)}
      </div>
      <div className="mc-grid">
        {Array.from({ length: offset }).map((_, i) => (
          <span key={`e${i}`} className="mc-cell mc-empty" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const dayISO = iso(d);
          const sel = dayISO === value;
          const isToday = dayISO === todayISO;
          const disabled = !!minISO && dayISO < minISO;
          return (
            <button
              key={d}
              type="button"
              className={`mc-cell${sel ? " mc-sel" : ""}${isToday ? " mc-today" : ""}`}
              disabled={disabled}
              onClick={() => onPick(dayISO)}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const WHEEL_H = 48;
const WHEEL_VISIBLE = 5;
const HOURS_LIST = Array.from({ length: 24 }, (_, i) => i);
const MINS_LIST = Array.from({ length: 60 }, (_, i) => i);

function ScrollWheel({
  items,
  initial,
  onIndex,
}: {
  items: number[];
  initial: number;
  onIndex: (i: number) => void;
}) {
  const n = items.length;
  // Sürekli konum: tam sayı = bir değer ortalanmış. Sürüklerken kesirli olur,
  // bırakınca en yakın tam sayıya animasyonla oturur (dönen makara hissi).
  const [pos, setPos] = useState(initial);
  const [smooth, setSmooth] = useState(false);
  const posRef = useRef(initial);
  posRef.current = pos;
  const cbRef = useRef(onIndex);
  cbRef.current = onIndex;
  const lastIdx = useRef(initial);

  function goTo(p: number, animate: boolean) {
    setSmooth(animate);
    setPos(p);
    const idx = ((Math.round(p) % n) + n) % n;
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      cbRef.current(idx);
    }
  }

  const drag = useRef<{ startY: number; startPos: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, startPos: posRef.current };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    // Parmağı birebir takip et (1 satır yüksekliği = 1 değer)
    goTo(drag.current.startPos - (e.clientY - drag.current.startY) / WHEEL_H, false);
  }
  function endDrag(e: React.PointerEvent) {
    if (!drag.current) return;
    // Son konumu state yerine doğrudan olaydan hesapla (bayat ref riskine karşı)
    const p = drag.current.startPos - (e.clientY - drag.current.startY) / WHEEL_H;
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    goTo(Math.round(p), true);
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    goTo(Math.round(posRef.current) + dir, true);
  }

  // Merkez etrafında ±4 satır çiz; uzaklaştıkça küçülüp solar, hafif 3D döner
  const base = Math.round(pos);
  const rows = [];
  for (let k = base - 4; k <= base + 4; k++) {
    const val = items[((k % n) + n) % n];
    const off = k - pos;
    const dist = Math.min(3, Math.abs(off));
    rows.push(
      <div
        key={k}
        className={`sw-row${smooth ? " anim" : ""}`}
        style={{
          transform: `translateY(${off * WHEEL_H}px) rotateX(${off * -16}deg) scale(${Math.max(0.5, 1 - 0.16 * dist)})`,
          opacity: Math.max(0, 1 - 0.32 * dist),
        }}
      >
        {String(val).padStart(2, "0")}
      </div>
    );
  }

  return (
    <div
      className="sw-wrap"
      style={{ height: WHEEL_VISIBLE * WHEEL_H }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
    >
      <div className="sw-stage" style={{ height: WHEEL_H, marginTop: -WHEEL_H / 2 }}>
        {rows}
      </div>
      <div className="sw-band" />
    </div>
  );
}

function TimePicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (hhmm: string) => void;
}) {
  const now = new Date();
  const initH = value ? Number(value.split(":")[0]) : now.getHours();
  const initM = value ? Number(value.split(":")[1]) : now.getMinutes();
  const hourRef = useRef(initH);
  const minRef = useRef(initM);

  function emit() {
    const hh = String(hourRef.current).padStart(2, "0");
    const mm = String(minRef.current).padStart(2, "0");
    onPick(`${hh}:${mm}`);
  }

  return (
    <div className="tps">
      <div className="tps-wheels">
        <ScrollWheel
          items={HOURS_LIST}
          initial={initH}
          onIndex={(i) => { hourRef.current = i; }}
        />
        <span className="tps-colon">:</span>
        <ScrollWheel
          items={MINS_LIST}
          initial={initM}
          onIndex={(i) => { minRef.current = i; }}
        />
      </div>
      <button type="button" className="primary-btn rp-submit" onClick={emit}>
        Tamam
      </button>
    </div>
  );
}

export function ReminderPopup({
  onAdd,
  onClose,
  initialDate,
}: {
  onAdd: (title: string, targetAt: string, description?: string) => void;
  onClose: () => void;
  // Takvimden açılınca tarih önceden seçili gelir
  initialDate?: string;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(initialDate ?? "");
  const [time, setTime] = useState("");
  const [showCal, setShowCal] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // Geçmişe hatırlatıcı kurulamaz
  const isPast = !!date && !!time && new Date(`${date}T${time}`).getTime() <= Date.now();

  function submit() {
    const t = title.trim();
    if (!t || !date || !time || isPast) return;
    const iso = new Date(`${date}T${time}`).toISOString();
    onAdd(t, iso, desc.trim() || undefined);
  }

  function fmtDate(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal reminder-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span className="popover-title">Hatırlatıcı ekle</span>
          <button className="modal-x" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        <div className="rp-field">
          <label className="rp-label">Başlık</label>
          <input
            className="rp-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ne hatırlatılsın?"
            autoFocus
          />
        </div>

        <div className="rp-field">
          <label className="rp-label">Açıklama <span className="muted small">(opsiyonel)</span></label>
          <textarea
            className="rp-textarea"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Detay ekle…"
            rows={2}
          />
        </div>

        <div className="rp-row">
          <div className="rp-field rp-half">
            <label className="rp-label">Tarih</label>
            <button
              type="button"
              className={`rp-input rp-picker-btn${date ? "" : " muted"}`}
              onClick={() => { setShowCal(!showCal); setShowTime(false); }}
            >
              {date ? fmtDate(date) : "Gün seç"}
            </button>
          </div>
          <div className="rp-field rp-half">
            <label className="rp-label">Saat</label>
            <button
              type="button"
              className={`rp-input rp-picker-btn${time ? "" : " muted"}`}
              onClick={() => { setShowTime(!showTime); setShowCal(false); }}
            >
              {time || "Saat seç"}
            </button>
          </div>
        </div>

        <Collapse open={showCal}>
          <MiniCal
            value={date}
            minISO={todayISO}
            onPick={(d) => { setDate(d); setShowCal(false); }}
          />
        </Collapse>

        <Collapse open={showTime}>
          <TimePicker
            value={time}
            onPick={(t) => { setTime(t); setShowTime(false); }}
          />
        </Collapse>

        {isPast ? (
          <p className="rp-past-warn small">Geçmişe hatırlatıcı kurulamaz.</p>
        ) : null}

        <button
          className="primary-btn rp-submit"
          disabled={!title.trim() || !date || !time || isPast}
          onClick={submit}
        >
          Kaydet
        </button>
      </div>
    </div>,
    document.body
  );
}

// --- To-do sekmesi ---

function overdueLabel(dayISO: string, todayISO: string): string {
  const diff = Math.round(
    (new Date(todayISO + "T00:00:00").getTime() - new Date(dayISO + "T00:00:00").getTime()) / 86400000
  );
  return diff === 1 ? "dün" : `${diff} gün önce`;
}

// Zorluk rozetinin etiketi + rengi
function difficultyMeta(
  d: TodoDifficulty | null
): { label: string; color: string } | null {
  if (d === "kolay") return { label: "kolay", color: "#2db866" };
  if (d === "orta") return { label: "orta", color: "#e0a12f" };
  if (d === "zor") return { label: "zor", color: "#e5484d" };
  return null;
}

// Deadline'a kalan süreyi kısa etikete çevir ("2 gün", "5 sa", "gecikti")
function deadlineLabel(deadline: string): { label: string; expired: boolean } {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { label: "gecikti", expired: true };
  const totalMin = Math.floor(diff / 60000);
  if (totalMin >= 1440)
    return { label: `${Math.ceil(totalMin / 1440)} gün`, expired: false };
  const h = Math.floor(totalMin / 60);
  if (h >= 1) return { label: `${h} sa`, expired: false };
  return { label: `${totalMin} dk`, expired: false };
}

function TodoTab({
  todos,
  overdueTodos,
  todayISO,
  onAddTodo,
  onToggle,
  onDelete,
  onMoveOverdueToToday,
  onCompleteOverdue,
  onDeleteOverdue,
}: {
  todos: TodoItem[];
  overdueTodos: TodoItem[];
  todayISO: string;
  onAddTodo: (title: string, extra?: TodoExtra) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onMoveOverdueToToday: (id: string) => void;
  onCompleteOverdue: (id: string) => void;
  onDeleteOverdue: (id: string) => void;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [, tick] = useState(0);

  // Deadline rozetlerini canlı tutmak için dakikada bir yenile
  useEffect(() => {
    const id = setInterval(() => tick((v) => v + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const todoItems = todos.filter((t) => t.day === todayISO && !t.habitId);

  return (
    <div className="rtab-inner">
      {overdueTodos.length > 0 ? (
        <div className="overdue-sec">
          <span className="overdue-title small">Geciken</span>
          <ul className="rtab-list">
            {overdueTodos.map((it) => (
              <li key={it.id} className="rtab-item todo-item overdue-item">
                <input
                  type="checkbox"
                  className="rtab-check"
                  checked={false}
                  onChange={() => onCompleteOverdue(it.id)}
                  title="Tamamla"
                />
                <span className="rtab-item-text">
                  {it.title}
                  <span className="overdue-when small">{overdueLabel(it.day, todayISO)}</span>
                </span>
                <button
                  className="overdue-move-btn"
                  onClick={() => onMoveOverdueToToday(it.id)}
                  title="Bugüne taşı"
                >
                  ↷
                </button>
                <button className="rtab-del-btn" onClick={() => onDeleteOverdue(it.id)}>×</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {todoItems.length === 0 ? (
        <button className="todo-create-big" onClick={() => setShowPopup(true)}>
          <span className="todo-create-plus">+</span>
          <span className="todo-create-label">to-do oluştur</span>
        </button>
      ) : (
        <>
          <ul className="todo-cards">
            {todoItems.map((it) => {
              const diff = difficultyMeta(it.difficulty);
              const dl = it.deadline ? deadlineLabel(it.deadline) : null;
              return (
                <li key={it.id} className={`todo-card${it.done ? " done" : ""}`}>
                  <input
                    type="checkbox"
                    className="todo-card-check"
                    checked={it.done}
                    onChange={(e) => onToggle(it.id, e.target.checked)}
                  />
                  <div className="todo-card-body">
                    <div className="todo-card-title">{it.title}</div>
                    {it.description ? (
                      <div className="todo-card-desc muted small">
                        {it.description}
                      </div>
                    ) : null}
                    {dl || diff ? (
                      <div className="todo-card-badges">
                        {dl ? (
                          <span
                            className={`todo-badge deadline${dl.expired ? " expired" : ""}`}
                          >
                            {dl.label}
                          </span>
                        ) : null}
                        {diff ? (
                          <span
                            className="todo-badge diff"
                            style={{ background: diff.color }}
                          >
                            {diff.label}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <button
                    className="rtab-del-btn todo-card-del"
                    onClick={() => onDelete(it.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            className="rtab-agenda-btn"
            onClick={() => setShowPopup(true)}
          >
            + to-do ekle
          </button>
        </>
      )}

      {showPopup ? (
        <TodoPopup
          onAdd={(title, extra) => {
            onAddTodo(title, extra);
            setShowPopup(false);
          }}
          onClose={() => setShowPopup(false)}
        />
      ) : null}
    </div>
  );
}

// --- To-do ekleme popup'ı (zorluk + opsiyonel deadline) ---

function TodoPopup({
  onAdd,
  onClose,
}: {
  onAdd: (title: string, extra: TodoExtra) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [difficulty, setDifficulty] = useState<TodoDifficulty>("orta");
  const [wantsDeadline, setWantsDeadline] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [showCal, setShowCal] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  function fmtDate(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  function submit() {
    const t = title.trim();
    if (!t) return;
    const deadline =
      wantsDeadline && date && time
        ? new Date(`${date}T${time}`).toISOString()
        : null;
    onAdd(t, { description: desc.trim() || null, difficulty, deadline });
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal reminder-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popover-head">
          <span className="popover-title">To-do ekle</span>
          <button className="modal-x" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        <div className="rp-field">
          <label className="rp-label">Başlık</label>
          <input
            className="rp-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ne yapılacak?"
            autoFocus
          />
        </div>

        <div className="rp-field">
          <label className="rp-label">
            Açıklama <span className="muted small">(opsiyonel)</span>
          </label>
          <textarea
            className="rp-textarea"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Detay ekle…"
            rows={2}
          />
        </div>

        <div className="rp-field">
          <label className="rp-label">Zorluk</label>
          <div className="todo-diff-seg">
            {(["kolay", "orta", "zor"] as TodoDifficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                className={`todo-diff-opt ${d}${difficulty === d ? " active" : ""}`}
                onClick={() => setDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <label className="todo-deadline-toggle">
          <input
            type="checkbox"
            checked={wantsDeadline}
            onChange={(e) => {
              setWantsDeadline(e.target.checked);
              if (!e.target.checked) {
                setShowCal(false);
                setShowTime(false);
              }
            }}
          />
          <span>Süre belirle</span>
        </label>

        {wantsDeadline ? (
          <>
            <div className="rp-row">
              <div className="rp-field rp-half">
                <label className="rp-label">Tarih</label>
                <button
                  type="button"
                  className={`rp-input rp-picker-btn${date ? "" : " muted"}`}
                  onClick={() => { setShowCal(!showCal); setShowTime(false); }}
                >
                  {date ? fmtDate(date) : "Gün seç"}
                </button>
              </div>
              <div className="rp-field rp-half">
                <label className="rp-label">Saat</label>
                <button
                  type="button"
                  className={`rp-input rp-picker-btn${time ? "" : " muted"}`}
                  onClick={() => { setShowTime(!showTime); setShowCal(false); }}
                >
                  {time || "Saat seç"}
                </button>
              </div>
            </div>

            <Collapse open={showCal}>
              <MiniCal
                value={date}
                minISO={todayISO}
                onPick={(d) => { setDate(d); setShowCal(false); }}
              />
            </Collapse>

            <Collapse open={showTime}>
              <TimePicker
                value={time}
                onPick={(t) => { setTime(t); setShowTime(false); }}
              />
            </Collapse>
          </>
        ) : null}

        <button
          className="primary-btn rp-submit"
          disabled={!title.trim()}
          onClick={submit}
        >
          Kaydet
        </button>
      </div>
    </div>,
    document.body
  );
}
