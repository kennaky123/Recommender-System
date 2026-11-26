import React from 'react';
import { MoodTag } from '../types';

interface MoodFilterBarProps {
  activeMood: MoodTag;
  onSelectMood: (mood: MoodTag) => void;
}

const MOODS: Array<{ id: MoodTag; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'intense', label: 'INTENSE' },
  { id: 'dramatic', label: 'DRAMATIC' },
  { id: 'mind-bending', label: 'MIND-BENDING' },
  { id: 'epic', label: 'EPIC' },
  { id: 'fun', label: 'FUN' },
  { id: 'calm', label: 'CALM' },
];

export const MoodFilterBar: React.FC<MoodFilterBarProps> = ({
  activeMood,
  onSelectMood,
}) => {
  return (
    <div className="relative z-10 pl-20 lg:pl-24 pr-8 pb-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#87899D] mr-2 shrink-0">
        MOOD AI
      </span>
      {MOODS.map((m) => {
        const active = activeMood === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelectMood(m.id)}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] rounded-[2px] border transition-colors cursor-pointer shrink-0 ${
              active
                ? 'bg-white text-[#0F1429] border-white'
                : 'bg-transparent text-[#B8C0D4] border-[#373B47] hover:border-[#87899D] hover:text-white'
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
};
