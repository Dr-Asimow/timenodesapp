import { useState } from "react";
import { signIn, signUp } from "../db";

export function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) return;
    setBusy(true);
    setErr(null);
    try {
      if (mode === "up") {
        if (password.length < 6) throw new Error("Şifre en az 6 karakter olmalı.");
        await signUp(u, password);
      } else {
        await signIn(u, password);
      }
      // Başarılıysa onAuthStateChange App'i günceller
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Bir hata oluştu.";
      setErr(translateError(msg));
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand big">
          <span className="logo">◳</span> TimeNodes
        </div>
        <p className="muted">Haftalık zaman takip</p>

        <div className="mode-toggle">
          <button
            type="button"
            className={mode === "in" ? "on" : ""}
            onClick={() => {
              setMode("in");
              setErr(null);
            }}
          >
            Giriş
          </button>
          <button
            type="button"
            className={mode === "up" ? "on" : ""}
            onClick={() => {
              setMode("up");
              setErr(null);
            }}
          >
            Kayıt ol
          </button>
        </div>

        <label>
          Kullanıcı adı
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="kullanıcı adı"
            autoCapitalize="none"
          />
        </label>
        <label>
          Şifre
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {err ? <p className="login-err">{err}</p> : null}

        <button className="primary-btn" type="submit" disabled={busy}>
          {busy ? "..." : mode === "up" ? "Hesap oluştur" : "Giriş yap"}
        </button>
        <p className="hint">
          Mail doğrulama yok — kullanıcı adı + şifre yeter. Verilerin Supabase'de
          güvenli (RLS) saklanır, başka cihazdan da giriş yapabilirsin.
        </p>
      </form>
    </div>
  );
}

function translateError(msg: string): string {
  if (/Invalid login credentials/i.test(msg))
    return "Kullanıcı adı veya şifre hatalı.";
  if (/User already registered/i.test(msg))
    return "Bu kullanıcı adı zaten alınmış. Giriş yapmayı dene.";
  if (/at least 6/i.test(msg)) return "Şifre en az 6 karakter olmalı.";
  return msg;
}
