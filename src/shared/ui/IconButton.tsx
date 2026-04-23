import type { MouseEventHandler, ReactNode } from 'react';

interface IconButtonProps {
  icon?: string;
  label?: string;
  title: string;
  compact?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children?: ReactNode;
}

export function IconButton({ icon, label, title, compact = false, disabled = false, onClick, children }: IconButtonProps) {
  return (
    <button
      className={`icon-button ${compact ? 'icon-button--compact' : ''}`}
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {icon ? <img className="icon-button__img" src={icon} alt="" aria-hidden="true" /> : null}
      {children}
      {label ? <span className="icon-button__label">{label}</span> : null}
    </button>
  );
}
