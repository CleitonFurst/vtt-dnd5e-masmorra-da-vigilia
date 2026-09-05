import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string;
}

/** Mostra falhas de render na tela em vez de tela branca silenciosa. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[VTT ErrorBoundary]', error, info.componentStack);
    this.setState({ info: info.componentStack ?? '' });
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-overlay">
        <div className="panel crash-box">
          <h2>Algo quebrou na interface</h2>
          <pre>{this.state.error.message}</pre>
          <pre className="muted">{this.state.info.slice(0, 1200)}</pre>
          <button onClick={() => location.reload()}>Recarregar</button>
        </div>
      </div>
    );
  }
}

