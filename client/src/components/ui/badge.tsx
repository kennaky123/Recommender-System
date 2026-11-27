import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-white bg-white text-[#0F1429]',
        outline: 'border-[#87899D] bg-transparent text-white',
        gold: 'border-[#F0EA75] bg-[#F0EA75] text-[#0F1429] font-extrabold',
        secondary: 'border-[#373B47] bg-[#0F1429]/85 text-[#C8D0E0]',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
