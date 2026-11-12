import { Button } from "@ctrl-ui/react/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ctrl-ui/react/ui/empty";
import {
  PageActions,
  PageBody,
  PageDescription,
  PageHeader,
  PageLayout,
  type PageLayoutProps,
  PageTitle,
  type PageWidth,
} from "@ctrl-ui/react/ui/page-layout";
import { Skeleton } from "@ctrl-ui/react/ui/skeleton";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A full view of the app: a titled page whose header doubles as the window's drag strip. */
export function ViewLayout({
  title,
  description,
  actions,
  width = "content",
  scrollViewportRef,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  width?: PageWidth;
  /** For lists that render only what is scrolled into view. */
  scrollViewportRef?: PageLayoutProps["scrollViewportRef"];
  children: ReactNode;
}) {
  return (
    <PageLayout
      className="h-full"
      scroll="inset"
      scrollViewportRef={scrollViewportRef}
      width={width}
    >
      <PageHeader data-tauri-drag-region variant="sticky">
        <PageTitle data-tauri-drag-region>{title}</PageTitle>
        {description ? (
          <PageDescription data-tauri-drag-region>
            {description}
          </PageDescription>
        ) : null}
        {actions ? <PageActions>{actions}</PageActions> : null}
      </PageHeader>
      <PageBody contentClassName="flex flex-col gap-5">{children}</PageBody>
    </PageLayout>
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
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
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
    <Empty role="alert">
      <EmptyHeader>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onRetry} size="sm" variant="surface">
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}

const SKELETON_ROW_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <output aria-label="Loading" className="flex flex-col gap-2">
      {SKELETON_ROW_KEYS.slice(0, rows).map((key) => (
        <Skeleton className="h-14" key={key} />
      ))}
    </output>
  );
}
