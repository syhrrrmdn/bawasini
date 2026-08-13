import type { LogItem } from "@/lib/bulkSender/types";

function formatLog(log: LogItem) {
  const label = log.label ?? `Object ${log.index}`;
  const status = typeof log.status === "number" ? String(log.status) : "-";
  const result = log.ok ? "OK" : "FAIL";
  return `${result}\t${status}\t${label}\t${log.message}`;
}

function StatusMark({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
          : "inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-700"
      }
      aria-hidden
    >
      {ok ? "✔" : "✖"}
    </span>
  );
}

export function LogPanel({ logs }: { logs: LogItem[] }) {
  return (
    <div className="h-80 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50">
      {logs.length === 0 ? (
        <div className="p-4 text-sm text-zinc-600">
          Log masih kosong. Jalankan Start untuk mulai mengirim request.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {logs.map((log) => (
            <li key={log.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <StatusMark ok={log.ok} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <div className="font-medium text-zinc-900">
                      {log.label ?? `Object ${log.index}`}
                    </div>
                    {typeof log.status === "number" ? (
                      <div className="text-zinc-600">Status {log.status}</div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        const text = formatLog(log);
                        void navigator.clipboard.writeText(text);
                      }}
                      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="mt-1 break-words text-sm text-zinc-700">
                    {log.message}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
