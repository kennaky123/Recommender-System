import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Database,
  LogIn,
  LogOut,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/context/AuthContext';

interface TelemetryHeaderProps {
  dimBrand?: boolean;
  storageMode: 'postgres' | 'memory-fallback';
  remoteOpen: boolean;
  onToggleRemote: () => void;
}

function formatArrivalCountdown(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hrs = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `T-${days}:${String(hrs).padStart(2, '0')}:${String(mins).padStart(
    2,
    '0'
  )}:${String(secs).padStart(2, '0')}`;
}

export const TelemetryHeader: React.FC<TelemetryHeaderProps> = ({
  dimBrand = false,
  storageMode,
  remoteOpen,
  onToggleRemote,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [countdown, setCountdown] = useState(199491);
  const [clock, setClock] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 199491));
      const now = new Date();
      setClock(
        `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}`
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="relative z-30 w-full border-b border-[#373B47] bg-gradient-to-b from-[#020204] to-[#060911]/95 px-6 lg:px-10 h-[66px] flex items-center justify-between gap-4 select-none">
      {/* Left: Stretched SPACEX wordmark + Mission Clock */}
      <Link
        to="/"
        className={`flex items-center gap-5 transition-opacity duration-200 ${
          dimBrand ? 'opacity-40' : 'opacity-100'
        }`}
      >
        <svg
          viewBox="0 0 220 28"
          className="h-[18px] w-auto text-white fill-current shrink-0"
          aria-label="SPACEX"
        >
          <path d="M5 20.5h15.2c2.5 0 3.9-.9 3.9-2.4 0-1.4-1.2-2.2-3.9-2.4l-9-.6C6.4 14.8 4 12.9 4 9.7 4 6.2 7.2 4.5 12.7 4.5h14.7v3.3H12.9c-2.6 0-3.9.7-3.9 2.1 0 1.2 1.1 1.9 3.8 2.1l9.1.6c5 .4 7.3 2.2 7.3 5.5 0 3.7-3.1 5.7-8.7 5.7H5v-3.3z" />
          <path d="M36.5 4.5h15.2c5.4 0 8.5 2.1 8.5 6.2 0 4.2-3.1 6.3-8.5 6.3H41.4v6.8h-4.9V4.5zm14.7 9.3c2.7 0 4.1-.9 4.1-3s-1.4-3-4.1-3h-9.8v6h9.8z" />
          <path d="M74.4 4.5h5.7l11 19.3h-5.3l-2.3-4.2H71.1l-2.3 4.2h-5.1L74.4 4.5zm7.2 11.9l-4.3-7.9-4.3 7.9h8.6z" />
          <path d="M97 14.2c0-6.2 4.3-10.1 11.6-10.1h10.7v3.4h-10.3c-4.4 0-6.9 2.4-6.9 6.6 0 4.3 2.5 6.6 6.9 6.6h10.3v3.3h-10.7C101.3 24 97 20.2 97 14.2z" />
          <path d="M126.8 4.5h19.6v3.3h-14.7v4.7h12.6v3.2h-12.6v4.8h15.1v3.3h-20V4.5z" />
          <path d="M153.2 4.5h6.1l10.6 8.3-4.2 3.1-12.5-11.4z" />
          <path d="M174.1 15.8l12.2 8h-6.3l-9.9-6.6 4-1.4z" />
          <path d="M153.5 23.8C166.5 13.7 183 6.1 215 1.8c-24.2 4.9-40.9 12.1-54.8 22h-6.7z" />
        </svg>

        <span className="text-[16px] font-bold tracking-wider text-white tabular-nums">
          {clock}
        </span>
      </Link>

      {/* Center Telemetry Metrics */}
      <div className="hidden md:flex items-center gap-6 lg:gap-9 xl:gap-10">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.14em] text-[#87899D]">
            ACTIVE PHASE
          </span>
          <span className="text-[14px] lg:text-[15px] font-bold uppercase tracking-wide text-white">
            DIAGNOSTIC CHECKS
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.14em] text-[#87899D]">
            ARRIVAL TIME
          </span>
          <span className="text-[14px] lg:text-[15px] font-bold tracking-wide text-white tabular-nums">
            {formatArrivalCountdown(countdown)}
          </span>
        </div>
      </div>

      {/* Right Orbital Telemetry Cluster + Auth + Companion Remote */}
      <div className="flex items-center gap-4 lg:gap-6">
        <div className="hidden 2xl:flex items-center gap-5">
          {[
            { label: 'INERTIAL VELOCITY', value: '7.69', unit: 'km/s' },
            { label: 'ALTITUDE', value: '393.3', unit: 'km' },
            { label: 'APOGEE', value: '416.2', unit: 'km' },
            { label: 'PERIGEE', value: '379.4', unit: 'km' },
            { label: 'INCLINATION', value: '51.62', unit: '°' },
          ].map((m) => (
            <div key={m.label} className="flex flex-col">
              <span className="text-[8.5px] uppercase tracking-[0.12em] text-[#87899D]">
                {m.label}
              </span>
              <span className="text-[14px] font-bold text-white tabular-nums leading-tight">
                {m.value}
                <span className="text-[11px] font-normal text-[#B8C0D4] ml-0.5">
                  {m.unit}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-[#373B47]/60">
          <span
            title={
              storageMode === 'postgres'
                ? 'PostgreSQL Connected'
                : 'In-Memory Demo Mode'
            }
            className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#B8C0D4] px-2 py-1 border border-[#373B47] rounded-[2px]"
          >
            <Database
              size={12}
              strokeWidth={2.2}
              className={
                storageMode === 'postgres' ? 'text-[#F0EA75]' : 'text-[#87899D]'
              }
            />
            <span>{storageMode === 'postgres' ? 'PGSQL' : 'DEMO'}</span>
          </span>

          {isAuthenticated && user ? (
            <button
              type="button"
              onClick={logout}
              title={`Signed in as ${user.name} (${user.email}) — Click to Sign Out`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-[11px] font-bold uppercase tracking-wider border border-[#F0EA75]/60 text-[#F0EA75] hover:bg-[#F0EA75]/10 cursor-pointer"
            >
              <LogOut size={14} strokeWidth={2.2} />
              <span className="hidden md:inline max-w-[110px] truncate">
                {user.name}
              </span>
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-[11px] font-bold uppercase tracking-wider border border-[#373B47] text-[#C8D0E0] hover:border-white hover:text-white"
            >
              <LogIn size={14} strokeWidth={2.2} />
              <span>SIGN IN</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onToggleRemote}
            title="Toggle Crew Dragon Companion Remote"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              remoteOpen
                ? 'spacex-backlit-btn'
                : 'border border-[#373B47] text-[#C8D0E0] hover:border-white hover:text-white'
            }`}
          >
            <Smartphone
              size={14}
              strokeWidth={remoteOpen ? 2.2 : 1.75}
            />
            <span className="hidden sm:inline">REMOTE</span>
          </button>
        </div>
      </div>
    </header>
  );
};
