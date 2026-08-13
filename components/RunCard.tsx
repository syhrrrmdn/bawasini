import type { BulkSenderConfig, ParsedDataResult } from "@/lib/bulkSender/types";
import type { BulkSenderController } from "@/hooks/useBulkSender";

import { Card } from "@/components/Card";
import { Button } from "@/components/Inputs";
import { ProgressBar } from "@/components/ProgressBar";
import { StatsGrid } from "@/components/StatsGrid";

export function RunCard({
  sender,
  config,
  parsed,
  isBusy,
}: {
  sender: BulkSenderController;
  config: BulkSenderConfig;
  parsed: ParsedDataResult;
  isBusy: boolean;
}) {
  const canStart = Boolean(!isBusy && parsed.ok && parsed.items.length > 0 && config.endpoint.trim());
  const canStop = sender.status === "running";
  const canRetry = Boolean(!isBusy && sender.failedItems.length > 0);

  return (
    <Card title="Progress & Kontrol">
      <div className="space-y-4">
        <ProgressBar value={sender.progressPercent} label={`${sender.processed} / ${sender.total || 0}`} />

        <StatsGrid
          total={sender.total}
          success={sender.success}
          failed={sender.failed}
          remaining={sender.remaining}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="primary"
            disabled={!canStart}
            onClick={() => {
              if (!parsed.ok) return;
              const targets = parsed.items.map((item, i) => ({ index: i + 1, item }));
              void sender.start(targets, config);
            }}
          >
            Start
          </Button>
          <Button variant="danger" disabled={!canStop} onClick={() => sender.stop()}>
            Stop
          </Button>
          <Button variant="secondary" disabled={!canRetry} onClick={() => void sender.retryFailed(config)}>
            Retry Failed
          </Button>
          <Button variant="secondary" disabled={isBusy} onClick={() => sender.reset()}>
            Reset
          </Button>
        </div>

        <div className="text-xs text-zinc-500">
          Status: <span className="font-medium text-zinc-800">{sender.status}</span>
        </div>
      </div>
    </Card>
  );
}
