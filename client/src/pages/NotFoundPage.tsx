import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="pl-20 lg:pl-24 pr-8 py-16">
      <Card className="p-8 max-w-lg">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F0EA75]">
          TELEMETRY SIGNAL LOST • 404
        </div>
        <h1 className="text-[28px] font-bold uppercase tracking-wide text-white mt-2">
          SECTOR NOT FOUND
        </h1>
        <p className="text-[14px] text-[#C8D0E0] mt-2">
          The requested Space-X VOD coordinates are outside the orbital catalog.
        </p>
        <Button
          type="button"
          variant="backlit"
          onClick={() => navigate({ to: '/' })}
          className="mt-6 px-6"
        >
          RETURN TO HOME DECK
        </Button>
      </Card>
    </div>
  );
};
