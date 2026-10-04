import { useRef, useState } from "react";
import { ShieldCheck, LockKeyhole } from "lucide-react";
import PageHead from "./AdminPageHead";
import CalendarConnection from "./CalendarConnection";


export default function Seguridad({ token, onChangePassword }) {
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirmation: "",
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const pendiente = useRef(false);

  const actualizarCampo = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }));
    setError("");
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (pendiente.current) return;
    if (form.new_password !== form.confirmation) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (form.current_password === form.new_password) {
      setError("Usa una contraseña diferente a la actual.");
      return;
    }

    pendiente.current = true;
    setGuardando(true);
    try {
      const actualizado = await onChangePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      if (actualizado) setForm({ current_password: "", new_password: "", confirmation: "" });
    } catch (error) {
      setError(error.message || "No pudimos actualizar la contraseña.");
    } finally {
      pendiente.current = false;
      setGuardando(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Seguridad"
        title="Cambia tu contraseña"
        text="Actualiza el acceso desde una sesión abierta. Al guardar, deberás iniciar sesión otra vez."
      />
      <section className="admin-panel max-w-xl">
        <div className="security-intro">
          <span className="security-icon"><ShieldCheck size={20} /></span>
          <div>
            <strong>Acceso del administrador</strong>
            <p>La clave debe tener al menos 8 caracteres. No compartas el código maestro de recuperación.</p>
          </div>
        </div>
        <form className="formulario security-form grid gap-4" onSubmit={guardar}>
          <div className="campo">
            <label htmlFor="current-password">Contraseña actual</label>
            <input
              id="current-password"
              type="password"
              minLength={8}
              value={form.current_password}
              autoComplete="current-password"
              onChange={(event) => actualizarCampo("current_password", event.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="new-password">Nueva contraseña</label>
            <input
              id="new-password"
              type="password"
              minLength={8}
              value={form.new_password}
              autoComplete="new-password"
              onChange={(event) => actualizarCampo("new_password", event.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="confirm-password">Repite la nueva contraseña</label>
            <input
              id="confirm-password"
              type="password"
              minLength={8}
              value={form.confirmation}
              autoComplete="new-password"
              onChange={(event) => actualizarCampo("confirmation", event.target.value)}
              required
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-principal" type="submit" disabled={guardando}><LockKeyhole size={17} aria-hidden="true" />{guardando ? "Actualizando…" : "Actualizar contraseña"}</button>
        </form>
      </section>
      <CalendarConnection token={token} />
    </>
  );
}
