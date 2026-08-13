import { Card } from "@/components/Card";

export function DataInputCard({
  rawText,
  setRawText,
  disabled,
}: {
  rawText: string;
  setRawText: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Card title="Input Data">
      <div className="space-y-3">
        <div className="grid gap-2">
          <div className="text-xs font-medium text-zinc-600">
            Upload File (JSON/TXT)
          </div>
          <input
            type="file"
            accept=".json,.txt,application/json,text/plain"
            disabled={disabled}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              setRawText(text);
            }}
            className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800 disabled:opacity-50"
          />
        </div>

        <div className="grid gap-2">
          <div className="text-xs font-medium text-zinc-600">Paste JSON</div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={disabled}
            placeholder={`{ "email": "a@gmail.com" },\n{ "email": "b@gmail.com" }`}
            className="h-64 w-full resize-none rounded-lg border border-zinc-200 bg-white p-3 font-mono text-xs leading-5 text-zinc-900 outline-none transition focus:border-blue-500 disabled:bg-zinc-100"
          />
          <div className="text-xs text-zinc-500">
            Bisa berupa array JSON valid, single object, atau banyak object
            dipisahkan koma tanpa tanda [ ].
          </div>
        </div>
      </div>
    </Card>
  );
}
