import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/shared/components/ui/button";

export function ViewLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-5 overflow-auto px-8 py-8">
      {children}
    </div>
  );
}

export function ViewHeader({
  actions,
  description,
  title,
}: {
  actions?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <header className="flex min-h-12 items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="font-semibold text-lg">{title}</h1>
        <p className="mt-0.5 max-w-2xl text-muted-foreground text-sm">
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">{title}</p>
      <p className="mt-1 max-w-sm text-muted-foreground text-sm">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
      <p className="max-w-md text-destructive text-sm">{message}</p>
      <Button className="mt-4" onClick={onRetry} size="sm" variant="outline">
        Try again
      </Button>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <output aria-label="Loading" className="block space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <div
          className="h-14 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
          key={`skeleton-${index + 1}`}
        />
      ))}
    </output>
  );
}
