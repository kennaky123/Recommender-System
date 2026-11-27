import { useCallback, useEffect } from 'react';
import { NavCategory, RecommendedMovie } from '../types';
import { VodRowConfig } from './useVodFeed';

export type DpadDirection = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';

interface UseDpadNavigationParams {
  activeCategory: NavCategory;
  activeRows: VodRowConfig[];
  focusedMovie: RecommendedMovie | null;
  sidebarExpanded: boolean;
  isPlayerOpen: boolean;
  isSeriesOpen: boolean;
  onFocusMovie: (movie: RecommendedMovie) => void;
  onExpandSidebar: (expanded: boolean) => void;
  onClosePlayer: () => void;
  onCloseSeries: () => void;
  onResetToHome: () => void;
  onLaunchWatch: (movie: RecommendedMovie) => void;
}

/**
 * Single Responsibility hook: manages keyboard arrow / Escape and Crew Dragon Remote D-pad navigation.
 */
export function useDpadNavigation({
  activeCategory,
  activeRows,
  focusedMovie,
  sidebarExpanded,
  isPlayerOpen,
  isSeriesOpen,
  onFocusMovie,
  onExpandSidebar,
  onClosePlayer,
  onCloseSeries,
  onResetToHome,
  onLaunchWatch,
}: UseDpadNavigationParams) {
  const handleDpadNavigate = useCallback(
    (dir: DpadDirection) => {
      if (dir === 'back') {
        if (isPlayerOpen) {
          onClosePlayer();
        } else if (isSeriesOpen) {
          onCloseSeries();
        } else if (sidebarExpanded) {
          onExpandSidebar(false);
        } else if (activeCategory !== 'home') {
          onResetToHome();
        }
        return;
      }

      if (dir === 'ok' && focusedMovie) {
        onLaunchWatch(focusedMovie);
        return;
      }

      if (activeRows.length === 0 || !focusedMovie) return;
      let rIdx = activeRows.findIndex((r) =>
        r.items.some((i) => i.id === focusedMovie.id)
      );
      if (rIdx < 0) rIdx = 0;
      let cIdx = activeRows[rIdx].items.findIndex((i) => i.id === focusedMovie.id);
      if (cIdx < 0) cIdx = 0;

      if (dir === 'left') {
        if (cIdx === 0) {
          onExpandSidebar(true);
        } else {
          onExpandSidebar(false);
          onFocusMovie(activeRows[rIdx].items[cIdx - 1]);
        }
      } else if (dir === 'right') {
        onExpandSidebar(false);
        const nextC = Math.min(activeRows[rIdx].items.length - 1, cIdx + 1);
        onFocusMovie(activeRows[rIdx].items[nextC]);
      } else if (dir === 'down') {
        const nextR = Math.min(activeRows.length - 1, rIdx + 1);
        const targetCol = Math.min(activeRows[nextR].items.length - 1, cIdx);
        onFocusMovie(activeRows[nextR].items[targetCol]);
      } else if (dir === 'up') {
        const prevR = Math.max(0, rIdx - 1);
        const targetCol = Math.min(activeRows[prevR].items.length - 1, cIdx);
        onFocusMovie(activeRows[prevR].items[targetCol]);
      }
    },
    [
      activeCategory,
      activeRows,
      focusedMovie,
      isPlayerOpen,
      isSeriesOpen,
      sidebarExpanded,
      onClosePlayer,
      onCloseSeries,
      onExpandSidebar,
      onFocusMovie,
      onLaunchWatch,
      onResetToHome,
    ]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleDpadNavigate('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleDpadNavigate('right');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleDpadNavigate('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleDpadNavigate('down');
      } else if (e.key === 'Escape') {
        handleDpadNavigate('back');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDpadNavigate]);

  return { handleDpadNavigate };
}
