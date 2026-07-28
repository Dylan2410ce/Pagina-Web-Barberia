import { useState } from "react";
import {
  Eye,
  EyeOff,
  ImagePlus,
  Link,
  Trash2,
  Upload,
} from "lucide-react";
import AdminPageHead from "./AdminPageHead";

const initial = {
  image_url: "",
  title: "",
  alt_text: "",
  category: "Cortes",
  description: "",
  display_order: 0,
};

export default function AdminGallery({
  items = [],
  onCreate,
  onUpload,
  onEdit,
  onDelete,
}) {
  const [mode, setMode] = useState("file");
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState(null);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    let saved = false;
    if (mode === "file") {
      if (!file) return;
      const body = new FormData();
      body.append("image", file);
      body.append("title", form.title.trim());
      body.append("alt_text", form.alt_text.trim());
      body.append("category", form.category.trim());
      body.append("description", form.description.trim());
      body.append("display_order", String(Number(form.display_order || 0)));
      saved = await onUpload(body);
    } else {
      saved = await onCreate({
        ...form,
        image_url: form.image_url.trim(),
        title: form.title.trim(),
        alt_text: form.alt_text.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        display_order: Number(form.display_order || 0),
        is_active: true,
      });
    }
    if (saved) {
      setForm(initial);
      setFile(null);
      formElement.reset();
    }
  };

  return (
    <>
      <AdminPageHead
        eyebrow="Galería"
        title="Trabajos que hablan por ti"
        text="Ordena las fotos que aparecen en la sección de cortes recientes."
      />
      <div className="gallery-admin-layout">
        <section className="admin-panel gallery-editor">
          <div className="segmented-control" aria-label="Origen de la imagen">
            <button className={mode === "file" ? "activo" : ""} type="button" onClick={() => setMode("file")}>
              <Upload size={16} />Subir archivo
            </button>
            <button className={mode === "url" ? "activo" : ""} type="button" onClick={() => setMode("url")}>
              <Link size={16} />Usar enlace
            </button>
          </div>
          <form className="formulario gallery-form" onSubmit={submit}>
            {mode === "file" ? (
              <div className="campo">
                <label htmlFor="gallery-file">Imagen</label>
                <input
                  className="visually-hidden"
                  id="gallery-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  required
                />
                <label className="gallery-file-picker" htmlFor="gallery-file">
                  <Upload size={20} />
                  <span>
                    <strong>{file?.name || "Seleccionar imagen"}</strong>
                    <small>{file ? "Toca para cambiarla" : "JPG, PNG o WebP"}</small>
                  </span>
                </label>
                <small>JPG, PNG o WebP. Máximo según la configuración del servidor.</small>
              </div>
            ) : (
              <div className="campo">
                <label htmlFor="gallery-url">URL HTTPS</label>
                <input
                  id="gallery-url"
                  type="url"
                  value={form.image_url}
                  placeholder="https://..."
                  onChange={(event) => update("image_url", event.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-doble">
              <div className="campo">
                <label htmlFor="gallery-title">Nombre del estilo</label>
                <input id="gallery-title" value={form.title} minLength={2} maxLength={100} onChange={(event) => update("title", event.target.value)} required />
              </div>
              <div className="campo">
                <label htmlFor="gallery-category">Categoría</label>
                <input id="gallery-category" value={form.category} minLength={2} maxLength={60} onChange={(event) => update("category", event.target.value)} required />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="gallery-alt">Descripción accesible</label>
              <input id="gallery-alt" value={form.alt_text} minLength={5} maxLength={180} placeholder="Ej.: degradado bajo con textura superior" onChange={(event) => update("alt_text", event.target.value)} required />
            </div>
            <div className="campo">
              <label htmlFor="gallery-description">Texto visible</label>
              <textarea id="gallery-description" rows={3} value={form.description} minLength={8} maxLength={300} onChange={(event) => update("description", event.target.value)} required />
            </div>
            <div className="campo">
              <label htmlFor="gallery-order">Orden</label>
              <input id="gallery-order" type="number" min="0" max="999" value={form.display_order} onChange={(event) => update("display_order", event.target.value)} />
            </div>
            <button className="btn btn-principal btn-ancho" type="submit" disabled={mode === "file" && !file}>
              <ImagePlus size={17} />
              Añadir a la galería
            </button>
          </form>
        </section>

        <section className="admin-panel gallery-library">
          <div className="admin-panel-head">
            <div><span>Publicaciones</span><h2>{items.length} imágenes</h2></div>
          </div>
          <div className="gallery-admin-grid">
            {items.length === 0 && (
              <div className="admin-empty"><ImagePlus size={24} /><strong>Aún no hay imágenes.</strong></div>
            )}
            {items.map((item) => (
              <article key={item.id}>
                <img src={item.image_url} alt={item.alt_text} loading="lazy" />
                <div>
                  <span>{item.category}</span>
                  <strong>{item.title}</strong>
                  <small>Orden {item.display_order}</small>
                </div>
                <div>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => onEdit(item.id, { is_active: !item.is_active })}
                    title={item.is_active ? "Ocultar" : "Publicar"}
                    aria-label={item.is_active ? "Ocultar imagen" : "Publicar imagen"}
                  >
                    {item.is_active ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                  <button className="icon-btn danger" type="button" onClick={() => onDelete(item)} title="Eliminar" aria-label="Eliminar imagen">
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
