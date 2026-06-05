import { useState } from "react";
import { signIn, signUp } from "../db";
import { Brand } from "./Brand";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
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
        if (!EMAIL_RE.test(email.trim()))
          throw new Error("Geçerli bir e-posta gir.");
        if (password.length < 6)
          throw new Error("Şifre en az 6 karakter olmalı.");
        await signUp(u, password, email);
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

  function switchMode(m: "in" | "up") {
    setMode(m);
    setErr(null);
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <Brand />

        <div className="mode-toggle">
          <button
            type="button"
            className={mode === "in" ? "on" : ""}
            onClick={() => switchMode("in")}
          >
            Giriş
          </button>
          <button
            type="button"
            className={mode === "up" ? "on" : ""}
            onClick={() => switchMode("up")}
          >
            Kayıt ol
          </button>
        </div>

        {mode === "up" ? (
          <label>
            E-posta
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
              autoCapitalize="none"
            />
          </label>
        ) : null}

        <label>
          Kullanıcı adı
          <input
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
          {mode === "up"
            ? "E-posta şimdilik sadece hesabına kaydedilir (doğrulama yok). Giriş kullanıcı adı + şifre ile."
            : "Verilerin Supabase'de güvenli (RLS) saklanır, başka cihazdan da giriş yapabilirsin."}
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
