// "İlk (manuel) alışkanlık" tebrik e-postası — Brevo transactional REST API ile.
// Frontend, kullanıcı kendi eklediği ilk alışkanlığı oluşturduğunda bu fonksiyonu
// supabase.functions.invoke("congrats-email") ile çağırır. Tek-seferlik garanti
// profiles.congrats_email_sent bayrağı ile sunucu tarafında sağlanır.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const SENDER_EMAIL = Deno.env.get("CONGRATS_SENDER_EMAIL") ?? "noreply@timenodes.app";
const SENDER_NAME = Deno.env.get("CONGRATS_SENDER_NAME") ?? "TimeNodes";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function congratsHtml(name: string | null): string {
  const hi = name ? `Merhaba ${name},` : "Merhaba,";
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;line-height:1.6">
    <h2 style="margin:0 0 12px">Tebrikler! İlk alışkanlığını oluşturdun 🎉</h2>
    <p style="margin:0 0 12px">${hi}</p>
    <p style="margin:0 0 12px">
      TimeNodes'ta ilk kendi alışkanlığını eklediğin için tebrikler. Zamanının
      gerçekte nereye gittiğini görmenin ilk adımını attın.
    </p>
    <p style="margin:0 0 12px">
      Küçük tut, düzenli işaretle — haftalar biriktikçe ilerlemeni net göreceksin.
    </p>
    <p style="margin:20px 0 0">
      <a href="https://timenodes.app"
         style="display:inline-block;background:#39d353;color:#0b0b0b;text-decoration:none;
                padding:10px 18px;border-radius:8px;font-weight:600">
        TimeNodes'u aç
      </a>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:#888">— TimeNodes</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // JWT'den kullanıcıyı çöz
  const { data: userData, error: uErr } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (uErr || !user) return json({ error: "unauthorized" }, 401);
  if (!user.email) return json({ error: "no_email" }, 400);

  // Mükerrer engeli: bayrak zaten set ise hiçbir şey gönderme
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("congrats_email_sent, display_name")
    .eq("id", user.id)
    .single();
  if (pErr) return json({ error: "profile_not_found" }, 404);
  if (profile.congrats_email_sent) return json({ skipped: true });

  // Brevo transactional e-posta
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email: user.email, name: profile.display_name ?? undefined }],
      subject: "Tebrikler! İlk alışkanlığını oluşturdun 🎉",
      htmlContent: congratsHtml(profile.display_name),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: "brevo_failed", detail }, 502);
  }

  // Yalnızca başarılı gönderimden sonra bayrağı set et
  await supabase
    .from("profiles")
    .update({ congrats_email_sent: true })
    .eq("id", user.id);

  return json({ sent: true });
});
