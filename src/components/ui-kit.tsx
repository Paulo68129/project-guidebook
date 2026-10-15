import type { ReactNode } from "react";

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "ok" | "warn" | "bad" }) {
  const c = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${c}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-4 ${className}`}>
      {title && <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function RouteError({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{error instanceof Error ? error.message : String(error)}</div>;
}
