import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-red-50 rounded-xl border border-red-100 m-4">
                    <div className="bg-red-100 p-4 rounded-full mb-4">
                        <AlertOctagon size={48} className="text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
                    <p className="text-gray-600 mb-6 max-w-md">
                        The dashboard encountered an unexpected error while rendering this section.
                    </p>

                    <div className="flex gap-4">
                        <button
                            onClick={() => this.setState({ hasError: false })}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Try to Recover
                        </button>
                        <button
                            onClick={this.handleRetry}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Reload Page
                        </button>
                    </div>

                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <div className="mt-8 p-4 bg-gray-800 text-red-300 text-xs text-left rounded-lg overflow-auto max-w-full w-full font-mono">
                            <p className="font-bold mb-2">{this.state.error.toString()}</p>
                            <pre>{this.state.errorInfo?.componentStack}</pre>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
