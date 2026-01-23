import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
    children?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo)
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-red-500 bg-zinc-900 h-screen overflow-auto">
                    <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
                    <pre className="text-sm font-mono bg-zinc-950 p-4 rounded border border-red-900">
                        {this.state.error?.message}
                        {'\n'}
                        {this.state.error?.stack}
                    </pre>
                </div>
            )
        }

        return this.props.children
    }
}
