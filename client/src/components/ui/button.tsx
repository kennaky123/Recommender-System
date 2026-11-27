import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] text-[12px] font-bold uppercase tracking-[0.08em] transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-white text-[#0F1429] hover:bg-white/90',
        backlit: 'spacex-backlit-btn text-[#0F1429]',
        outline:
          'border border-[#87899D]/70 bg-transparent text-white hover:border-white hover:bg-white/10',
        secondary:
          'border border-[#373B47] bg-[#0B1023] text-[#C8D0E0] hover:border-white hover:text-white',
        ghost:
          'border border-transparent bg-transparent text-white/90 hover:border-[#87899D]/70 hover:bg-white/5',
        gold: 'border border-[#F0EA75] bg-[#F0EA75]/10 text-[#F0EA75] hover:bg-[#F0EA75]/20',
      },
      size: {
        default: 'h-[42px] px-5',
        sm: 'h-8 px-3 text-[11px]',
        lg: 'h-[42px] px-9 text-[13px]',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
