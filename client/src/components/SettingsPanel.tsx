import React from 'react';
import {
  Database,
  Cpu,
  Star,
  X,
  Globe,
  SignIn,
  SignOut,
} from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useUserProfileQuery } from '@/hooks/useVodQueries';
import { RecommendationFeed } from '@/types';

interface SettingsPanelProps {
  feed: RecommendationFeed;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  feed,
  onClose,
}) => {
  const { activeUserId, isAuthenticated, logout } = useAuth();
  const { data: profileData } = useUserProfileQuery(activeUserId);

  return (
    <div className="relative z-10 pl-20 lg:pl-24 pr-8 py-8 min-h-[calc(100dvh-66px)]">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-[22px] font-bold uppercase tracking-[0.06em] text-white">
          CABIN SYSTEM & RECOMMENDATION ENGINE
        </h1>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          <X size={14} weight="bold" />
          <span>BACK TO HOME</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
        {/* User Profile */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-4 mb-4">
              <img
                src={
                  profileData?.profile.avatarUrl ??
                  '/backdrops/claude-patterson.jpg'
                }
                alt={profileData?.profile.name ?? 'Passenger'}
                className="w-12 h-12 rounded-full object-cover grayscale border border-white/30"
              />
              <div className="min-w-0">
                <div className="text-[15px] font-bold uppercase tracking-wider text-white truncate">
                  {profileData?.profile.name ?? 'CLAUDE PATTERSON'}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-[#87899D] truncate">
                  {profileData?.profile.email ?? `CABIN PROFILE • USER #${activeUserId}`}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#373B47] text-center">
              <div>
                <div className="text-[18px] font-bold text-white tabular-nums">
                  {profileData?.ratings.length ??
                    feed.engineStats.userRatingsCount}
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
                  {profileData?.watchHistoryCount ??
                    feed.continueWatching.length}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-[#87899D]">
                  WATCHED
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#373B47]">
              {isAuthenticated ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={logout}
                  className="w-full"
                >
                  <SignOut size={14} weight="bold" />
                  <span>SIGN OUT</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="backlit"
                  size="sm"
                  asChild
                  className="w-full"
                >
                  <Link to="/login">
                    <SignIn size={14} weight="bold" />
                    <span>SIGN IN / REGISTER ACCOUNT</span>
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PostgreSQL & MovieLens Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[12px]">
              <Database size={16} className="text-[#F0EA75]" />
              <span>POSTGRESQL & MOVIELENS DATA</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                className={
                  feed.tmdbEnabled ? 'text-[#F0EA75]' : 'text-[#87899D]'
                }
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
          </CardContent>
        </Card>

        {/* Hybrid Weights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[12px]">
              <Cpu size={16} className="text-[#F0EA75]" />
              <span>HYBRID AI WEIGHTS</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-[12px]">
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
                  <span className="font-bold text-white tabular-nums">
                    {w.pct}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#131A35] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F0EA75]"
                    style={{ width: `${w.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* User Ratings History */}
      {profileData && profileData.ratings.length > 0 && (
        <Card className="mt-6 max-w-5xl">
          <CardHeader>
            <CardTitle className="text-[12px]">
              YOUR RECENT RATINGS (USED FOR REAL-TIME RE-RANKING)
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};
