import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8" aria-label="Loading career profile">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-5 space-y-3 rounded-xl border border-border bg-surface/50 p-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
