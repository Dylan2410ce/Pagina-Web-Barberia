export default function AdminPageHead({ eyebrow, title, text, action }) {
  return (
    <header className="admin-page-head">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </header>
  );
}
