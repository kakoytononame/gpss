export function IconButton({ icon, label, title, className = '', ...props }) {
  return (
    <button className={`icon-button ${className}`} type="button" title={title || label} aria-label={label || title} {...props}>
      <span aria-hidden="true">{icon}</span>
      {label ? <span className="icon-button__label">{label}</span> : null}
    </button>
  );
}
