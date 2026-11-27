import React from 'react';
import { SettingsPanel } from '../components/SettingsPanel';
import { useVodShell } from '../context/VodShellContext';

export const SettingsPage: React.FC = () => {
  const { feed, navigateToCategory } = useVodShell();

  if (!feed) {
    return (
      <div className="pl-24 pr-10 pt-16">
        <div className="h-48 max-w-3xl bg-[#131A35] rounded-[6px] animate-pulse" />
      </div>
    );
  }

  return (
    <SettingsPanel feed={feed} onClose={() => navigateToCategory('home')} />
  );
};
