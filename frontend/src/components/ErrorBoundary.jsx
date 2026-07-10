import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error de interfaz:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="pantalla-carga error-screen">
          <h1>Algo no cargó bien.</h1>
          <p>Refrescá la página y volvé a intentarlo. Si sigue pasando, revisá la consola del navegador.</p>
          <button className="btn btn-principal" type="button" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
