import React from 'react';
import {
  MagnifyingGlass,
  House,
  FilmReel,
  TelevisionSimple,
  Broadcast,
  MusicNote,
  GearSix,
} from '@phosphor-icons/react';
import { NavCategory } from '../types';

interface LeftSidebarProps {
  activeCategory: NavCategory;
  expanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  onSelectCategory: (cat: NavCategory) => void;
  userName: string;
  avatarUrl: string;
}

const MAIN_ITEMS: Array<{
  id: NavCategory;
  label: string;
  Icon: React.ElementType;
}> = [
  { id: 'search', label: 'SEARCH', Icon: MagnifyingGlass },
  { id: 'home', label: 'HOME', Icon: House },
  { id: 'films', label: 'FILMS', Icon: FilmReel },
  { id: 'shows', label: 'SHOWS', Icon: TelevisionSimple },
  { id: 'live', label: 'LIVE', Icon: Broadcast },
  { id: 'audio', label: 'AUDIO', Icon: MusicNote },
];

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeCategory,
  expanded,
  onExpandChange,
  onSelectCategory,
  userName,
  avatarUrl,
}) => {
  return (
    <aside
      onMouseEnter={() => onExpandChange(true)}
      onMouseLeave={() => onExpandChange(false)}
      className={`fixed left-0 top-[66px] bottom-0 z-40 flex flex-col justify-between py-6 transition-all duration-200 select-none ${
        expanded
          ? 'w-[285px] pl-6 pr-8 bg-gradient-to-r from-[#04060A] via-[#060914]/95 to-transparent'
          : 'w-[76px] pl-5 pr-2 bg-transparent'
      }`}
    >
      <div className="flex flex-col gap-5">
        {/* User Profile Row */}
        <button
          type="button"
          onClick={() => onSelectCategory('settings')}
          className="flex items-center gap-4 text-left group cursor-pointer focus:outline-none"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden border border-white/25 bg-[#101831] shrink-0">
            <img
              src={avatarUrl}
              alt={userName}
              className="w-full h-full object-cover grayscale"
            />
          </div>
          {expanded && (
            <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-white whitespace-nowrap">
              {userName}
            </span>
          )}
        </button>

        {/* Primary 6 Nav Icons */}
        <nav className="flex flex-col gap-2 mt-2" aria-label="Primary Navigation">
          {MAIN_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeCategory === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectCategory(id)}
                className={`relative flex items-center gap-4 h-11 px-2.5 transition-all cursor-pointer focus:outline-none ${
                  expanded && isActive
                    ? 'spacex-backlit-btn text-[#0F1429] font-bold'
                    : isActive
                    ? 'text-white font-bold'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                <Icon
                  size={20}
                  weight={isActive ? 'fill' : 'regular'}
                  className="shrink-0"
                />
                {expanded && (
                  <span className="text-[13px] font-bold uppercase tracking-[0.08em] whitespace-nowrap">
                    {label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Settings Icon */}
      <button
        type="button"
        onClick={() => onSelectCategory('settings')}
        className={`relative flex items-center gap-4 h-11 px-2.5 transition-all cursor-pointer focus:outline-none ${
          expanded && activeCategory === 'settings'
            ? 'spacex-backlit-btn text-[#0F1429] font-bold'
            : activeCategory === 'settings'
            ? 'text-white font-bold'
            : 'text-white/55 hover:text-white'
        }`}
      >
        <GearSix
          size={20}
          weight={activeCategory === 'settings' ? 'fill' : 'regular'}
          className="shrink-0"
        />
        {expanded && (
          <span className="text-[13px] font-bold uppercase tracking-[0.08em] whitespace-nowrap">
            SETTINGS
          </span>
        )}
      </button>
    </aside>
  );
};
