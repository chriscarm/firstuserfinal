import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

function AnnouncementSkeleton() {
  return (
    <div className="glass-panel p-4 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-1/4 mb-2" />
      <div className="h-6 bg-white/10 rounded w-3/4 mb-3" />
      <div className="h-4 bg-white/10 rounded w-full" />
    </div>
  );
}

function PollSkeleton() {
  return (
    <div className="glass-panel p-4 animate-pulse">
      <div className="h-5 bg-white/10 rounded w-2/3 mb-4" />
      <div className="space-y-2">
        <div className="h-10 bg-white/10 rounded" />
        <div className="h-10 bg-white/10 rounded" />
        <div className="h-10 bg-white/10 rounded" />
      </div>
    </div>
  );
}

function BadgeSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full glass-panel animate-pulse">
      <div className="h-5 w-5 bg-white/10 rounded" />
      <div className="h-4 w-20 bg-white/10 rounded" />
    </div>
  );
}

export { Skeleton, AnnouncementSkeleton, PollSkeleton, BadgeSkeleton }
