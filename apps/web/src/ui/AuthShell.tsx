import type { ReactNode } from "react";

export function AuthShell(props: { eyebrow: string; title: string; subtitle?: string; children: ReactNode; error?: string; busy?: boolean }) {
  return <main className="dg-auth-shell">
    <section className="dg-auth-frame" aria-labelledby="auth-title">
      <header className="dg-auth-header">
        <span className="dg-auth-mark" aria-hidden="true">秤</span>
        <div>
          <p className="eyebrow">{props.eyebrow}</p>
          <h1 id="auth-title">{props.title}</h1>
          {props.subtitle ? <p className="dg-auth-subtitle">{props.subtitle}</p> : null}
        </div>
      </header>
      <div className="dg-auth-form-wrap">
        {props.error ? <div className="dg-auth-error" role="alert"><strong>请求未完成</strong><p>{props.error}</p></div> : null}
        <div aria-busy={props.busy || undefined}>{props.children}</div>
      </div>
    </section>
  </main>;
}
