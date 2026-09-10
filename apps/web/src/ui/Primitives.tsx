import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type StatusKind = "loading" | "empty" | "error" | "offline" | "conflict" | "success" | "warning";

export function Button({ variant = "primary", busy = false, children, className = "", disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean }) {
  return <button {...props} className={`dg-button dg-button-${variant} ${className}`.trim()} data-button-variant={variant} data-hit-area="44" disabled={disabled || busy} aria-busy={busy || undefined}>{busy ? `${children}中…` : children}</button>;
}

export function IconButton({ label, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button {...props} className={`dg-icon-button ${className}`.trim()} aria-label={label} data-hit-area="44">{children}</button>;
}

export function Surface({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`dg-surface ${className}`.trim()}>{children}</div>;
}

export function Metric({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return <div className="dg-metric"><span>{label}</span><strong>{value}{unit ? <small>{unit}</small> : null}</strong></div>;
}

export function StatusMessage({ kind, title, description, action }: { kind: StatusKind; title: string; description?: string; action?: ReactNode }) {
  return <div className={`dg-status dg-status-${kind}`} data-status-kind={kind} role={kind === "error" || kind === "conflict" ? "alert" : "status"}><strong>{title}</strong>{description ? <p>{description}</p> : null}{action ? <div>{action}</div> : null}</div>;
}
