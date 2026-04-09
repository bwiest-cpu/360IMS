import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export const useSettingsStore = create((set, get) => ({
  company: null,
  loading: false,

  async load() {
    set({ loading: true })
    const { data } = await supabase.from('company_settings').select('*').eq('id', 1).maybeSingle()
    set({ company: data ?? null, loading: false })
  },

  async update(patch) {
    const { data, error } = await supabase
      .from('company_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single()
    if (error) throw error
    set({ company: data })
  }
}))
