import React from 'react';
import {
  MagnifyingGlass,
  ArrowCounterClockwise,
  UserPlus,
  House,
  FilmReel,
  TelevisionSimple,
  Broadcast,
  MusicNote,
  GearSix,
  SpeakerHigh,
  X,
} from '@phosphor-icons/react';
import { Slider } from '@/components/ui/slider';
import { NavCategory } from '../types';

interface MobileRemoteDrawerProps {
  open: boolean;
  activeCategory: NavCategory;
  onClose: () => void;
  onNavigate: (dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back') => void;
  onSelectCategory: (cat: NavCategory) => void;
  onToggleMyList: () => void;
}

export const MobileRemoteDrawer: React.FC<MobileRemoteDrawerProps> = ({
  open,
  activeCategory,
  onClose,
  onNavigate,
  onSelectCategory,
  onToggleMyList,
}) => {
  const [volume, setVolume] = React.useState(49);

  if (!open) return null;

  const tabs: Array<{ id: NavCategory; label: string; Icon: React.ElementType }> = [
    { id: 'home', label: 'HOME', Icon: House },
    { id: 'films', label: 'FILMS', Icon: FilmReel },
    { id: 'shows', label: 'SHOWS', Icon: TelevisionSimple },
    { id: 'live', label: 'LIVE', Icon: Broadcast },
    { id: 'audio', label: 'AUDIO', Icon: MusicNote },
    { id: 'settings', label: 'SETTINGS', Icon: GearSix },
  ];

  return (
    <aside className="fixed right-4 bottom-4 top-[78px] z-40 w-[300px] rounded-[18px] border border-[#373B47] bg-gradient-to-b from-[#0E152E] via-[#141B36] to-[#141B38] shadow-2xl flex flex-col justify-between p-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white">
          SPACEX REMOTE
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-[#87899D] hover:text-white cursor-pointer"
          aria-label="Close Companion Remote"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      {/* Crew Dragon Docking Touchpad + Corner Actions */}
      <div className="relative flex items-center justify-center my-2">
        <button
          type="button"
          onClick={() => onSelectCategory('search')}
          title="Search"
          className="absolute top-0 left-1 p-2 text-[#B8C0D4] hover:text-white cursor-pointer"
        >
          <MagnifyingGlass size={18} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('back')}
          title="Back"
          className="absolute bottom-0 left-1 p-2 text-[#B8C0D4] hover:text-white cursor-pointer"
        >
          <ArrowCounterClockwise size={18} />
        </button>
        <button
          type="button"
          onClick={onToggleMyList}
          title="Add to My List"
          className="absolute bottom-0 right-1 p-2 text-[#B8C0D4] hover:text-white cursor-pointer"
        >
          <UserPlus size={18} />
        </button>

        <div className="relative w-52 h-52 rounded-full bg-[#10183C] border border-white/25 flex items-center justify-center shadow-[inset_0_0_45px_rgba(59,91,157,0.45)]">
          <div className="w-24 h-24 rounded-full bg-[radial-gradient(circle,rgba(150,153,186,0.42)_0%,rgba(59,91,157,0.16)_55%,transparent_75%)] pointer-events-none" />

          <button
            type="button"
            onClick={() => onNavigate('up')}
            className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 text-[9px] font-bold tracking-[0.16em] text-[#C8D0E0] hover:text-white cursor-pointer"
          >
            UP
          </button>
          <button
            type="button"
            onClick={() => onNavigate('down')}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 text-[9px] font-bold tracking-[0.16em] text-[#C8D0E0] hover:text-white cursor-pointer"
          >
            DOWN
          </button>
          <button
            type="button"
            onClick={() => onNavigate('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[9px] font-bold tracking-[0.16em] text-[#C8D0E0] hover:text-white cursor-pointer"
          >
            LEFT
          </button>
          <button
            type="button"
            onClick={() => onNavigate('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[9px] font-bold tracking-[0.16em] text-[#C8D0E0] hover:text-white cursor-pointer"
          >
            RIGHT
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ok')}
            className="w-14 h-14 rounded-full border border-white/55 hover:border-white hover:bg-white/10 flex items-center justify-center text-[11px] font-bold tracking-widest text-white cursor-pointer active:scale-95 transition-transform"
          >
            OK
          </button>
        </div>
      </div>

      {/* Radix Slider Volume Control */}
      <div className="flex items-center gap-3 px-1">
        <SpeakerHigh size={16} className="text-[#C8D0E0] shrink-0" />
        <Slider
          min={0}
          max={100}
          step={1}
          value={[volume]}
          onValueChange={(vals) => setVolume(vals[0] ?? 49)}
          aria-label="Cabin audio volume"
        />
        <span className="text-[12px] font-bold text-white tabular-nums w-6 text-right">
          {volume}
        </span>
      </div>

      {/* Bottom 3x2 Quick-Jump Grid */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
        {tabs.map(({ id, label, Icon }) => {
          const active = activeCategory === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectCategory(id)}
              className={`relative flex flex-col items-center justify-center py-2 gap-1 transition-colors cursor-pointer ${
                active
                  ? 'text-white mobile-tab-glow'
                  : 'text-white/55 hover:text-white'
              }`}
            >
              <Icon size={17} weight={active ? 'fill' : 'regular'} />
              <span className="text-[9px] font-bold uppercase tracking-wider">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
