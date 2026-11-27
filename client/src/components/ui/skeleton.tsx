import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[6px] bg-[#131A35] border border-[#373B47]/40',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
