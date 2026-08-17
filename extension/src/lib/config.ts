// Fill these in from your web app's .env (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY),
// and point API_BASE_URL at your deployed (or local) devbrain web app.
export const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_ANON_KEY =
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY ?? ""
export const API_BASE_URL =
  process.env.PLASMO_PUBLIC_API_BASE_URL ?? "http://localhost:3000"
