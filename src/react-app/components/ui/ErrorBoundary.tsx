import { Component, type ComponentChildren } from "preact";
import { Button } from "./Button";

interface Props {
  children: ComponentChildren;
  fallback?: ComponentChildren;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ hasError: true, error });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-dvh items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
              Algo salió mal
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {this.state.error?.message || "Error desconocido"}
            </p>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              variant="primary"
            >
              Reintentar
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}