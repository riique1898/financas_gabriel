import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)
export const supabase = supabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

export type EntryKind = 'receita' | 'despesa'
export interface Entry {
  id: string
  descricao: string
  valor: number
  categoria: string
  data: string
  user_id: string
}
export interface Profile {
  id: string
  nome: string
  avatar_url: string | null
}
