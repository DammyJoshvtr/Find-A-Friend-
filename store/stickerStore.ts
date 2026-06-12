import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface UserSticker {
  id: string
  media_url: string
}

interface StickerState {
  stickers: UserSticker[]
  loading: boolean
  loaded: boolean
  loadStickers: () => Promise<void>
  addSticker: (url: string) => Promise<{ error: Error | null }>
  removeSticker: (id: string) => Promise<void>
}

export const useStickerStore = create<StickerState>((set, get) => ({
  stickers: [],
  loading: false,
  loaded: false,
  loadStickers: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      set({ loading: false })
      return
    }
    const { data } = await supabase
      .from('user_stickers')
      .select('id, media_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (data) set({ stickers: data, loaded: true })
    set({ loading: false })
  },
  addSticker: async (url: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not logged in') }

    // Avoid duplicates
    if (get().stickers.some(s => s.media_url === url)) {
      return { error: new Error('Sticker already saved') }
    }

    const { data, error } = await supabase
      .from('user_stickers')
      .insert({ user_id: user.id, media_url: url })
      .select('id, media_url')
      .single()

    if (error) return { error }
    if (data) {
      set(state => ({ stickers: [data, ...state.stickers] }))
    }
    return { error: null }
  },
  removeSticker: async (id: string) => {
    const { error } = await supabase.from('user_stickers').delete().eq('id', id)
    if (!error) {
      set(state => ({ stickers: state.stickers.filter(s => s.id !== id) }))
    }
  }
}))
