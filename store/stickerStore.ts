import { create } from 'zustand'
import { client } from '../lib/aws'

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
    // TODO: AWS Auth
    const { data: { user } } = await (client as any).auth.getUser()
    if (!user) {
      set({ loading: false })
      return
    }
    const { data } = await client.models.user_stickers.list({
      filter: { user_id: { eq: user.id } }
    } as any)
    
    if (data) set({ stickers: data, loaded: true })
    set({ loading: false })
  },
  addSticker: async (url: string) => {
    // TODO: AWS Auth
    const { data: { user } } = await (client as any).auth.getUser()
    if (!user) return { error: new Error('Not logged in') }

    // Avoid duplicates
    if (get().stickers.some(s => s.media_url === url)) {
      return { error: new Error('Sticker already saved') }
    }

    const { data, error } = await client.models.user_stickers.create({ user_id: user.id, media_url: url } as any)

    if (error) return { error }
    if (data) {
      set(state => ({ stickers: [data, ...state.stickers] }))
    }
    return { error: null }
  },
  removeSticker: async (id: string) => {
    const { error } = await client.models.user_stickers.delete({ id } as any)
    if (!error) {
      set(state => ({ stickers: state.stickers.filter(s => s.id !== id) }))
    }
  }
}))
