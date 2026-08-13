import type { ParsedDataResult } from "@/lib/bulkSender/types";

import { Card } from "@/components/Card";
import { JsonPreview } from "@/components/JsonPreview";

export function PreviewCard({
  parsed,
}: {
  parsed: ParsedDataResult;
}) {
  const items = parsed.ok ? parsed.items : [];
  const preview = items.slice(0, 3);

  return (
    <Card
      title="Preview"
      right={
        parsed.ok ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
            Total Data: {items.length} Objects
          </span>
        ) : null
      }
    >
      {parsed.ok ? (
        preview.length > 0 ? (
          <JsonPreview title="3 object pertama" value={preview} />
        ) : (
          <div className="text-sm text-zinc-600">Belum ada data untuk dipreview.</div>
        )
      ) : (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <div className="font-medium">Parsing gagal</div>
          <div className="mt-1">{parsed.message}</div>
          {typeof parsed.errorIndex === "number" ? (
            <div className="mt-1 text-rose-800">
              Perkiraan object yang bermasalah: #{parsed.errorIndex}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
