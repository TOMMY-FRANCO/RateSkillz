import { Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  isChunkError: boolean;
}

interface LazyErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

class LazyErrorBoundary extends Component<LazyErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: LazyErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Importing a module script failed');
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lazy page load error:', error, info);
  }

  retry = () => {
    this.setState({ hasError: false, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center px-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center space-y-5">
            <div className="w-14 h-14 mx-auto bg-cyan-500/10 border border-cyan-500/20 rounded-full flex items-center justify-center">
              <WifiOff className="w-7 h-7 text-cyan-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-lg" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {this.state.isChunkError ? 'Connection issue' : 'Page failed to load'}
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                {this.state.isChunkError
                  ? 'Could not download this page. Check your connection and try again.'
                  : 'Something went wrong loading this page. Please try again.'}
              </p>
            </div>
            <button
              onClick={this.retry}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-green-500 text-white font-semibold rounded-xl hover:from-cyan-400 hover:to-green-400 transition-all text-sm"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface LazyPageWrapperProps {
  children: ReactNode;
  skeleton: ReactNode;
}

export function LazyPageWrapper({ children, skeleton }: LazyPageWrapperProps) {
  return (
    <LazyErrorBoundary fallback={skeleton}>
      <Suspense fallback={skeleton}>
        {children}
      </Suspense>
    </LazyErrorBoundary>
  );
}
