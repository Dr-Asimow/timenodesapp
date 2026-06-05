import { useState } from "react";

export function Login({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="login-wrap">
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (username.trim()) onLogin(username.trim());
        }}
      >
        <div className="brand big">
          <span className="logo">◳</span> TimeNodes
        </div>
        <p className="muted">Haftalık zaman takip — prototip</p>

        <label>
          Kullanıcı adı
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="kullanıcı adı"
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

        <button className="primary-btn" type="submit">
          Giriş yap
        </button>
        <p className="hint">
          Şimdilik mail doğrulama yok; veriler bu tarayıcıda (localStorage)
          tutulur.
        </p>
      </form>
    </div>
  );
}
