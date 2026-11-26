import React from 'react';
import { ProviderName } from '../types';

interface ProviderLogoProps {
  provider: ProviderName;
  size?: 'sm' | 'md';
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({
  provider,
  size = 'sm',
}) => {
  const isMd = size === 'md';

  if (provider === 'NETFLIX') {
    return (
      <span
        className={`inline-block font-extrabold uppercase tracking-[0.12em] text-white ${
          isMd ? 'text-base' : 'text-[11px]'
        }`}
      >
        NETFLIX
      </span>
    );
  }

  if (provider === 'HBOmax') {
    return (
      <span
        className={`inline-flex items-baseline font-black tracking-tight text-white ${
          isMd ? 'text-base' : 'text-[11px]'
        }`}
      >
        <span className="tracking-[0.06em]">HBO</span>
        <span className="font-semibold lowercase tracking-normal opacity-90">max</span>
      </span>
    );
  }

  if (provider === 'Disney+') {
    return (
      <span
        className={`inline-flex items-baseline font-bold tracking-tight text-white ${
          isMd ? 'text-base' : 'text-[11px]'
        }`}
      >
        <span>Disney</span>
        <span className="ml-0.5 font-extrabold">+</span>
      </span>
    );
  }

  if (provider === 'sky cinema') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold lowercase text-white ${
          isMd ? 'text-base' : 'text-[11px]'
        }`}
      >
        <span className="font-extrabold tracking-tight">sky</span>
        <span className="opacity-85">cinema</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold lowercase text-white ${
        isMd ? 'text-base' : 'text-[11px]'
      }`}
    >
      <span className="font-extrabold tracking-tight">sky</span>
      <span className="opacity-85">one</span>
    </span>
  );
};
