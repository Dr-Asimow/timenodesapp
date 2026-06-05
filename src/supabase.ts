import { createClient } from "@supabase/supabase-js";

// Publishable (anon) key tarayıcıda kullanılmak için tasarlandı — public olması
// güvenlidir; veriyi RLS politikaları korur. Env ile override edilebilir.
const url =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://vlvfvlwevblonunulpne.supabase.co";
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_YmcbpvtsN91HjpCkYzoJXg_UUk76Bgd";

export const supabase = createClient(url, key);
