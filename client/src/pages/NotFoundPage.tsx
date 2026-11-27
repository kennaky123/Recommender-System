import React from 'react';
import { useNavigate } from '@tanstack/react-router';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="pl-20 lg:pl-24 pr-8 py-16">
      <div className="border border-[#373B47] bg-[#0B1023] p-8 rounded-[4px] max-w-lg">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F0EA75]">
          TELEMETRY SIGNAL LOST • 404
        </div>
        <h1 className="text-[28px] font-bold uppercase tracking-wide text-white mt-2">
          SECTOR NOT FOUND
        </h1>
        <p className="text-[14px] text-[#C8D0E0] mt-2">
          The requested Space-X VOD coordinates are outside the orbital catalog.
        </p>
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          className="spacex-backlit-btn mt-6 px-6 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] cursor-pointer"
        >
          RETURN TO HOME DECK
        </button>
      </div>
    </div>
  );
};
