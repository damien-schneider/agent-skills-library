import { warn } from "@tauri-apps/plugin-log";
import { Component, type ReactNode } from "react";

interface QueryErrorBoundaryProps {
  children: ReactNode;
  /** What to show instead of the failed part; `retry` renders the children again. */
  fallback: (retry: () => void) => ReactNode;
}

interface QueryErrorBoundaryState {
  failed: boolean;
}

/**
 * Convex reports a failed query by throwing while the component renders, and
 * React only lets a class catch that. Without it one failed query blanks the app.
 */
export class QueryErrorBoundary extends Component<
  QueryErrorBoundaryProps,
  QueryErrorBoundaryState
> {
  state: QueryErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): QueryErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    warn(`registry query failed: ${error.message}`);
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
