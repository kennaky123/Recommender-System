import React from 'react';
import {
  Search,
  Compass,
  Home,
  Film,
  Tv,
  Bookmark,
  Radio,
  Music,
  Settings,
  LogIn,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/context/AuthContext';
import { NavCategory } from '../types';

interface LeftSidebarProps {
  activeCategory: NavCategory;
  expanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  onSelectCategory: (cat: NavCategory) => void;
  userName?: string;
  avatarUrl?: string;
}

const MAIN_ITEMS: Array<{
  id: NavCategory;
  label: string;
  Icon: React.ElementType;
}> = [
  { id: 'search', label: 'SEARCH', Icon: Search },
  { id: 'discover', label: 'DISCOVER', Icon: Compass },
  { id: 'home', label: 'HOME', Icon: Home },
  { id: 'films', label: 'FILMS', Icon: Film },
  { id: 'shows', label: 'SHOWS', Icon: Tv },
  { id: 'my-list', label: 'MY LIST', Icon: Bookmark },
  { id: 'live', label: 'LIVE', Icon: Radio },
  { id: 'audio', label: 'AUDIO', Icon: Music },
];

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeCategory,
  expanded,
  onExpandChange,
  onSelectCategory,
  userName,
  avatarUrl,
}) => {
  const { user, isAuthenticated } = useAuth();
  const displayName = user?.name ?? userName ?? 'GUEST PASSENGER';
  const displayAvatar =
    user?.avatarUrl ?? avatarUrl ?? '/backdrops/claude-patterson.jpg';

  return (
    <motion.aside
      onMouseEnter={() => onExpandChange(true)}
      onMouseLeave={() => onExpandChange(false)}
      initial={false}
      animate={{ width: expanded ? 285 : 76 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`fixed left-0 top-[66px] bottom-0 z-40 flex flex-col justify-between py-6 select-none overflow-hidden ${
        expanded
          ? 'pl-6 pr-8 bg-gradient-to-r from-[#04060A] via-[#060914]/95 to-transparent'
          : 'pl-5 pr-2 bg-transparent'
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
              src={displayAvatar}
              alt={displayName}
              className="w-full h-full object-cover grayscale"
            />
          </div>
          {expanded && (
            <div className="min-w-0">
              <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-white truncate">
                {displayName}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-[#F0EA75]">
                {isAuthenticated ? 'AUTHENTICATED' : 'DEMO PROFILE'}
              </div>
            </div>
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
                className={`relative flex items-center gap-4 h-11 px-2.5 transition-colors cursor-pointer focus:outline-none ${
                  expanded && isActive
                    ? 'text-[#0F1429] font-bold'
                    : isActive
                    ? 'text-white font-bold'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {expanded && isActive && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 spacex-backlit-btn"
                  />
                )}
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.15 : 1.75}
                  className="relative z-10 shrink-0"
                />
                {expanded && (
                  <span className="relative z-10 text-[13px] font-bold uppercase tracking-[0.08em] whitespace-nowrap">
                    {label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Auth / Settings */}
      <div className="flex flex-col gap-2">
        {!isAuthenticated && (
          <Link
            to="/login"
            className="relative flex items-center gap-4 h-11 px-2.5 text-[#F0EA75]/85 hover:text-[#F0EA75] transition-all"
          >
            <LogIn size={20} strokeWidth={1.75} className="shrink-0" />
            {expanded && (
              <span className="text-[13px] font-bold uppercase tracking-[0.08em] whitespace-nowrap">
                SIGN IN
              </span>
            )}
          </Link>
        )}

        <button
          type="button"
          onClick={() => onSelectCategory('settings')}
          className={`relative flex items-center gap-4 h-11 px-2.5 transition-colors cursor-pointer focus:outline-none ${
            expanded && activeCategory === 'settings'
              ? 'text-[#0F1429] font-bold'
              : activeCategory === 'settings'
              ? 'text-white font-bold'
              : 'text-white/55 hover:text-white'
          }`}
        >
          {expanded && activeCategory === 'settings' && (
            <motion.span
              layoutId="sidebar-active-pill"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="absolute inset-0 spacex-backlit-btn"
            />
          )}
          <Settings
            size={20}
            strokeWidth={activeCategory === 'settings' ? 2.15 : 1.75}
            className="relative z-10 shrink-0"
          />
          {expanded && (
            <span className="relative z-10 text-[13px] font-bold uppercase tracking-[0.08em] whitespace-nowrap">
              SETTINGS
            </span>
          )}
        </button>
      </div>
    </motion.aside>
  );
};
