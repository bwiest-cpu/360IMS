import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export const useAuthStore = create((set, get) => ({
  session: null,
  user: null,          // Supabase auth user
  profile: null,       // public.users row
  loading: true,
  initialized: false,

  async initialize() {
    if (get().initialized) return
    set({ loading: true })
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await get().loadProfile(session)
    } else {
      set({ session: null, user: null, profile: null })
    }
    set({ loading: false, initialized: true })

    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession) {
        await get().loadProfile(newSession)
      } else {
        set({ session: null, user: null, profile: null })
      }
    })
  },

  async loadProfile(session) {
    const user = session?.user ?? null
    if (!user) {
      set({ session: null, user: null, profile: null })
      return
    }
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    set({ session, user, profile: profile ?? null })
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await get().loadProfile(data.session)
    return data
  },

  async signOut() {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null })
  },

  async refreshProfile() {
    const { session } = get()
    if (session) await get().loadProfile(session)
  }
}))
