import { Component } from 'react';
import { reportBoundaryError } from '@/shared/api/errorSink.js';

// Real error boundary: MUST be a class component — function components cannot
// catch render errors (no getDerivedStateFromError / componentDidCatch lifecycle).
export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Forward to the passive sink. The boundary swallows the throw, so this is
    // the ONLY place a render crash gets reported.
    reportBoundaryError(error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // DELIBERATELY no fallback UI. On an intelligence site a generic "something
      // went wrong" card reads as real content/state and becomes misinformation —
      // a reader can't tell a broken render from an intentionally-empty one. So the
      // boundary's only jobs are (1) stop one crash from white-screening the whole
      // app (nav/chrome outside this boundary survives) and (2) report to the sink
      // via componentDidCatch. The crashed region renders nothing.
      return null;
    }
    return this.props.children;
  }
}
