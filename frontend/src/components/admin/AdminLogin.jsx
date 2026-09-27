import { useState } from "react";
import { Home, Scissors, ShieldCheck, Eye, EyeOff } from "lucide-react";
import FormField from "../ui/FormField";

export default function Login({ onLogin, onResetPassword }) {
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [visible, setVisible] = useState(false);
  const [resetForm, setResetForm] = useState({
    username: "",
    master_code: "",
    new_password: "",
  });

  const enviarLogin = async (event) => {
    event.preventDefault();
    await onLogin(loginForm);
  };

  const enviarRecuperacion = async (event) => {
    event.preventDefault();
    const actualizado = await onResetPassword(resetForm);
    if (actualizado) {
      setResetForm({ username: "", master_code: "", new_password: "" });
    }
  };

  return (
    <section className="admin-login-page">
      <a className="btn btn-linea admin-back" href="/"><Home size={16} />Volver a la web</a>
      <div className="admin-login-shell">
        <div className="admin-login-copy">
          <span className="admin-login-mark"><Scissors size={26} /></span>
          <span className="eyebrow"><ShieldCheck size={14} />Acceso privado</span>
          <h1>Sebas Barber</h1>
          <p>Tu agenda. Tu negocio.</p>
        </div>
        <div className="admin-login-form">
          <div>
            <h2>Iniciar sesión</h2>
            <p>Acceso para Sebastián y Gabriel.</p>
          </div>
          <form className="formulario grid gap-4" onSubmit={enviarLogin}>
              <FormField label="Usuario"
                id="admin-user"
                name="username"
                value={loginForm.username}
                placeholder="sebas o gabriel"
                autoComplete="username"
                required
                onChange={(event) => setLoginForm((actual) => ({ ...actual, username: event.target.value }))}
              />
            <div className="campo password-field">
              <label htmlFor="admin-password">Contraseña</label>
              <input
                id="admin-password"
                name="password"
                type={visible ? "text" : "password"}
                minLength={8}
                value={loginForm.password}
                autoComplete="current-password"
                required
                onChange={(event) => setLoginForm((actual) => ({ ...actual, password: event.target.value }))}
              />
              <button className="password-toggle icon-btn" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            <button className="btn btn-principal btn-ancho" type="submit">Entrar al panel</button>
          </form>
          <details className="reset-box">
            <summary>Olvidé mi contraseña</summary>
            <form className="formulario grid gap-3" onSubmit={enviarRecuperacion}>
              <input
                name="username"
                value={resetForm.username}
                placeholder="Usuario"
                aria-label="Usuario"
                required
                onChange={(event) => setResetForm((actual) => ({ ...actual, username: event.target.value }))}
              />
              <input
                name="master_code"
                type="password"
                autoComplete="off"
                minLength={32}
                value={resetForm.master_code}
                placeholder="Código maestro"
                aria-label="Código maestro"
                required
                onChange={(event) => setResetForm((actual) => ({ ...actual, master_code: event.target.value }))}
              />
              <input
                name="new_password"
                type="password"
                minLength={8}
                value={resetForm.new_password}
                placeholder="Nueva contraseña"
                aria-label="Nueva contraseña"
                required
                onChange={(event) => setResetForm((actual) => ({ ...actual, new_password: event.target.value }))}
              />
              <button className="btn btn-secundario" type="submit">Cambiar contraseña</button>
            </form>
          </details>
        </div>
      </div>
    </section>
  );
}
