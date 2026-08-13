export function JsonPreview({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-zinc-600">{title}</div>
      <pre className="max-h-72 overflow-auto rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-900">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
