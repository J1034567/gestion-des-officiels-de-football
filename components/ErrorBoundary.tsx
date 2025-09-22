// components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from "react";

// A simple fallback UI component. You can customize this as needed.
const FallbackUI = () => (
  <div>
    <h2>Something went wrong.</h2>
    <p>We're sorry for the inconvenience. Please try refreshing the page.</p>
  </div>
);

// Define the types for the component's props and state
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  // FIX: Initialize state using a public class field instead of a constructor.
  // This is a more modern syntax and often resolves type inference issues.
  public state: State = {
    hasError: false,
  };

  // This lifecycle method updates the state so the next render will show the fallback UI.
  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  // This lifecycle method is for side effects like logging the error.
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  public render() {
    // If an error was caught, render the fallback UI.
    if (this.state.hasError) {
      return <FallbackUI />;
    }

    // Otherwise, render the children as normal.
    return this.props.children;
  }
}

export default ErrorBoundary;
