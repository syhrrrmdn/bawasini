import type { ReactNode } from "react";

export function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {right ? <div className="text-sm text-zinc-600">{right}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
