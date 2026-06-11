import { useState } from "react";
import { signIn, signUp } from "../db";
import { Brand } from "./Brand";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setErr(null);
    try {
      if (!EMAIL_RE.test(email.trim()))
        throw new Error("Geçerli bir e-posta gir.");
      if (mode === "up") {
        if (!displayName.trim())
          throw new Error("Görünen ad boş olamaz.");
        if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(password))
          throw new Error(
            "Şifre en az 8 karakter olmalı, harf ve rakam içermeli."
          );
        if (password !== password2)
          throw new Error("Şifreler eşleşmiyor, tekrar kontrol et.");
        const { needsConfirm } = await signUp(email, password, displayName);
        if (needsConfirm) {
          setSentTo(email.trim());
          setBusy(false);
          return;
        }
      } else {
        await signIn(email, password);
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
    setPassword2("");
  }

  if (sentTo) {
    return (
      <div className="login-wrap">
        <div className="login-card login-sent">
          <Brand />
          <div className="login-sent-icon">✉️</div>
          <h2 className="login-sent-title">E-postanı kontrol et</h2>
          <p className="login-sent-text">
            <strong>{sentTo}</strong> adresine bir onay bağlantısı gönderdik.
            Bağlantıya tıklayınca hesabın aktifleşir ve giriş yapabilirsin.
          </p>
          <p className="hint">
            E-posta birkaç dakika içinde gelmezse spam/gereksiz klasörünü
            kontrol et.
          </p>
          <button
            className="primary-btn"
            type="button"
            onClick={() => {
              setSentTo(null);
              switchMode("in");
            }}
          >
            Girişe dön
          </button>
        </div>
      </div>
    );
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

        <label>
          E-posta
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@mail.com"
            autoCapitalize="none"
            autoComplete="email"
          />
        </label>

        {mode === "up" ? (
          <label>
            Görünen ad
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="İsmin (sonradan değiştirebilirsin)"
              maxLength={40}
            />
          </label>
        ) : null}

        <label>
          Şifre
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
          />
        </label>

        {mode === "up" ? (
          <label>
            Şifre (tekrar)
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>
        ) : null}

        {err ? <p className="login-err">{err}</p> : null}

        <button className="primary-btn" type="submit" disabled={busy}>
          {busy ? "..." : mode === "up" ? "Hesap oluştur" : "Giriş yap"}
        </button>
        <p className="hint">
          {mode === "up"
            ? "Şifre en az 8 karakter, harf ve rakam içermeli. Görünen adını sonra değiştirebilirsin; sana özel bir UID otomatik verilir."
            : "Verilerin Supabase'de güvenli (RLS) saklanır, başka cihazdan da giriş yapabilirsin."}
        </p>
      </form>
    </div>
  );
}

function translateError(msg: string): string {
  if (/Email not confirmed/i.test(msg))
    return "E-postan henüz onaylanmadı. Gelen kutundaki onay bağlantısına tıkla.";
  if (/Invalid login credentials/i.test(msg))
    return "E-posta veya şifre hatalı.";
  if (/User already registered/i.test(msg))
    return "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.";
  if (/at least \d+ characters|password.*short/i.test(msg))
    return "Şifre en az 8 karakter olmalı, harf ve rakam içermeli.";
  if (/password should contain|one character of each/i.test(msg))
    return "Şifre harf ve rakam içermeli.";
  if (/valid email|invalid format/i.test(msg))
    return "Geçerli bir e-posta gir.";
  return msg;
}
