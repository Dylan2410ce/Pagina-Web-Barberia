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
          <h1>La pagina necesita recargarse.</h1>
          <p>Las citas que ya fueron confirmadas no se pierden.</p>
          <button className="btn btn-principal" type="button" onClick={() => window.location.reload()}>
            Recargar pagina
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
