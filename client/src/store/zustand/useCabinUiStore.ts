import { create } from 'zustand';
import { RecommendedMovie } from '@/types';

export interface PlayerModalState {
  movie: RecommendedMovie;
  mode: 'watch' | 'trailer';
  season: number;
  episode: number;
}

interface CabinUiState {
  sidebarExpanded: boolean;
  focusedMovie: RecommendedMovie | null;
  actionsVisible: boolean;
  playerState: PlayerModalState | null;
  toast: string | null;
  setSidebarExpanded: (expanded: boolean) => void;
  setFocusedMovie: (
    movie:
      | RecommendedMovie
      | null
      | ((prev: RecommendedMovie | null) => RecommendedMovie | null)
  ) => void;
  setActionsVisible: (visible: boolean) => void;
  openPlayer: (player: PlayerModalState) => void;
  closePlayer: () => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

let toastTimer: number | undefined;

/**
 * Zustand store managing high-frequency ephemeral Cabin UI/HUD state.
 */
export const useCabinUiStore = create<CabinUiState>((set) => ({
  sidebarExpanded: false,
  focusedMovie: null,
  actionsVisible: true,
  playerState: null,
  toast: null,

  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
  setFocusedMovie: (movieOrUpdater) =>
    set((s) => ({
      focusedMovie:
        typeof movieOrUpdater === 'function'
          ? movieOrUpdater(s.focusedMovie)
          : movieOrUpdater,
    })),
  setActionsVisible: (visible) => set({ actionsVisible: visible }),
  openPlayer: (player) => set({ playerState: player }),
  closePlayer: () => set({ playerState: null }),
  showToast: (msg) => {
    if (toastTimer) window.clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = window.setTimeout(() => {
      set({ toast: null });
    }, 3200);
  },
  clearToast: () => set({ toast: null }),
}));
