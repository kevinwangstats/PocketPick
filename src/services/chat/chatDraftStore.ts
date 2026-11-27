import { create } from 'zustand';

interface ChatDraftState {
  drafts: Record<string, string>;
  setDraft: (personId: string, text: string) => void;
  clearDraft: (personId: string) => void;
  clearAllDrafts: () => void;
}

export const useChatDraftStore = create<ChatDraftState>((set) => ({
  drafts: {},

  setDraft: (personId: string, text: string) => {
    set((state) => ({
      drafts: { ...state.drafts, [personId]: text },
    }));
  },

  clearDraft: (personId: string) => {
    set((state) => {
      const next = { ...state.drafts };
      delete next[personId];
      return { drafts: next };
    });
  },

  clearAllDrafts: () => set({ drafts: {} }),
}));
