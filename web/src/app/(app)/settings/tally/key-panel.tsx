"use client";

import { useState, useTransition } from "react";
import { makeTallyKey } from "@/app/actions/tally";
import { Card, buttonClass } from "@/components/ui";

export function KeyPanel({ hasKey }: { hasKey: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="space-y-3 text-sm">
      <p>{hasKey ? "A connector key is active. Making a new one stops the old one working." : "No connector key yet."}</p>
      {key && (
        <div className="rounded-lg border border-line bg-bg p-3">
          <p className="mb-1 text-xs text-muted">Copy this now. It is not shown again.</p>
          <code className="break-all select-all">{key}</code>
        </div>
      )}
      <button className={buttonClass("primary")} disabled={pending} onClick={() => start(async () => { const r = await makeTallyKey(); if (r.key) setKey(r.key); })}>
        {hasKey ? "Make a new key" : "Make a connector key"}
      </button>
    </Card>
  );
}
