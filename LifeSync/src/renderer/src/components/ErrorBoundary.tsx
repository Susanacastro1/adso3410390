import { Component, type ErrorInfo, type ReactElement, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Error inesperado de la interfaz'
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error de interfaz no controlado:', error, info)
  }

  render(): ReactElement | ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div className="error-card">
            <span className="error-icon"><AlertTriangle size={34} /></span>
            <h1>Algo salió mal</h1>
            <p>
              LifeSync encontró un problema inesperado. Tus datos siguen guardados en SQLite.
            </p>
            <code>{this.state.message}</code>
            <button
              type="button"
              className="button primary"
              onClick={() => window.location.reload()}
            >
              <RotateCcw size={17} /> Recargar aplicación
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
