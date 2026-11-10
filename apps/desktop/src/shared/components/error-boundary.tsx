import { error as logError } from "@tauri-apps/plugin-log";
import { Component, type ReactNode } from "react";

import { ErrorState } from "./view-layout";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** What to show instead of the failed part; `retry` renders the children again. */
  fallback: (retry: () => void) => ReactNode;
  /** Names the failed part in the app log. */
  label: string;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * React unmounts the whole tree when a render throws, which leaves the window
 * blank; a boundary keeps the failure to the part that threw and logs it.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    logError(`${this.props.label} failed: ${error.message}`).catch(() => {
      // Outside the desktop shell there is no log to write to.
    });
  }

  retry = () => {
    this.setState({ failed: false });
  };

  render() {
    return this.state.failed
      ? this.props.fallback(this.retry)
      : this.props.children;
  }
}

/** Keeps a failing view to itself, so the rest of the window stays usable. */
export function ViewBoundary({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <ErrorBoundary
      fallback={(retry) => (
        <div className="grid h-full place-items-center p-6">
          <ErrorState
            message="This part of the window stopped working. Your files were not changed."
            onRetry={retry}
          />
        </div>
      )}
      label={label}
    >
      {children}
    </ErrorBoundary>
  );
}
