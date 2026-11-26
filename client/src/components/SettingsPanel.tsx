import React, { useEffect, useState } from 'react';
import { Database, Cpu, Star, X, Globe } from '@phosphor-icons/react';
import { fetchUserProfile } from '../api';
import { RecommendationFeed, UserProfileResponse } from '../types';

interface SettingsPanelProps {
  feed: RecommendationFeed;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  feed,
  onClose,
}) => {
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);

  useEffect(() => {
    fetchUserProfile().then(setProfileData).catch(() => null);
  }, [feed.engineStats.userRatingsCount]);

  return (
    <div className="relative z-10 pl-20 lg:pl-24 pr-8 py-8 min-h-[calc(100dvh-66px)]">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-[22px] font-bold uppercase tracking-[0.06em] text-white">
          CABIN SYSTEM & RECOMMENDATION ENGINE
        </h1>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#373B47] hover:border-white text-[#C8D0E0] hover:text-white rounded-[2px] cursor-pointer"
        >
          <X size={14} weight="bold" />
          <span>BACK TO HOME</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
        {/* User Profile */}
        <div className="border border-[#373B47] bg-[#0B1023]/90 p-5 rounded-[4px]">
          <div className="flex items-center gap-4 mb-4">
            <img
              src="/backdrops/claude-patterson.jpg"
              alt="Claude Patterson"
              className="w-12 h-12 rounded-full object-cover grayscale border border-white/30"
            />
            <div>
              <div className="text-[15px] font-bold uppercase tracking-wider text-white">
                {profileData?.profile.name ?? 'CLAUDE PATTERSON'}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-[#87899D]">
                NFC CABIN PROFILE • USER #1
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#373B47] text-center">
            <div>
              <div className="text-[18px] font-bold text-white tabular-nums">
                {profileData?.ratings.length ?? feed.engineStats.userRatingsCount}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-[#87899D]">
                RATINGS
              </div>
            </div>
            <div>
              <div className="text-[18px] font-bold text-white tabular-nums">
                {profileData?.watchlistCount ?? feed.myList.length}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-[#87899D]">
                MY LIST
              </div>
            </div>
            <div>
              <div className="text-[18px] font-bold text-white tabular-nums">
                {profileData?.watchHistoryCount ?? feed.continueWatching.length}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-[#87899D]">
                WATCHED
              </div>
            </div>
          </div>
        </div>

        {/* PostgreSQL & MovieLens Status */}
        <div className="border border-[#373B47] bg-[#0B1023]/90 p-5 rounded-[4px]">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white mb-3">
            <Database size={16} className="text-[#F0EA75]" />
            <span>POSTGRESQL & MOVIELENS DATA</span>
          </div>
          <p className="text-[13px] text-[#C8D0E0] leading-relaxed">
            Storage mode:{' '}
            <strong className="text-[#F0EA75] uppercase">
              {feed.storageMode === 'postgres'
                ? 'PostgreSQL Connected'
                : 'In-Memory Fallback'}
            </strong>
          </p>
          <p className="text-[12px] text-[#87899D] mt-2 leading-relaxed tabular-nums">
            Catalog size:{' '}
            <strong className="text-white">
              {feed.engineStats.totalMovies.toLocaleString()}
            </strong>{' '}
            titles •{' '}
            <strong className="text-white">
              {feed.engineStats.totalRatings.toLocaleString()}
            </strong>{' '}
            community ratings.
          </p>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#373B47] text-[11px]">
            <Globe
              size={14}
              className={feed.tmdbEnabled ? 'text-[#F0EA75]' : 'text-[#87899D]'}
            />
            <span className="text-[#C8D0E0]">
              TMDB Global Search:{' '}
              <strong
                className={feed.tmdbEnabled ? 'text-[#F0EA75]' : 'text-white'}
              >
                {feed.tmdbEnabled
                  ? 'LIVE CONNECTED'
                  : 'NOT SET (add TMDB_API_KEY in server/.env)'}
              </strong>
            </span>
          </div>
        </div>

        {/* Hybrid Weights */}
        <div className="border border-[#373B47] bg-[#0B1023]/90 p-5 rounded-[4px]">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white mb-3">
            <Cpu size={16} className="text-[#F0EA75]" />
            <span>HYBRID AI WEIGHTS</span>
          </div>
          <div className="space-y-2.5 text-[12px]">
            {[
              {
                label: 'CONTENT-BASED (GENRES + TAGS + MOOD)',
                pct: Math.round(feed.engineStats.weights.contentBased * 100),
              },
              {
                label: 'ITEM-BASED COLLABORATIVE FILTERING',
                pct: Math.round(feed.engineStats.weights.collaborative * 100),
              },
              {
                label: 'BAYESIAN COMMUNITY POPULARITY',
                pct: Math.round(feed.engineStats.weights.popularityPrior * 100),
              },
            ].map((w) => (
              <div key={w.label}>
                <div className="flex justify-between text-[#C8D0E0] mb-1">
                  <span className="text-[10px] tracking-wider">{w.label}</span>
                  <span className="font-bold text-white tabular-nums">{w.pct}%</span>
                </div>
                <div className="h-1.5 bg-[#131A35] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F0EA75]"
                    style={{ width: `${w.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Ratings History */}
      {profileData && profileData.ratings.length > 0 && (
        <div className="mt-6 max-w-5xl border border-[#373B47] bg-[#0B1023]/90 p-5 rounded-[4px]">
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-white mb-3">
            YOUR RECENT RATINGS (USED FOR REAL-TIME RE-RANKING)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {profileData.ratings.map((r) => (
              <div
                key={r.movieId}
                className="flex items-center justify-between px-3 py-2 border border-[#373B47]/70 rounded-[3px] bg-[#0F1429]"
              >
                <span className="text-[12px] font-bold uppercase text-white truncate pr-2">
                  {r.movieTitle}
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#F0EA75] shrink-0">
                  <Star size={13} weight="fill" />
                  {r.rating}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
