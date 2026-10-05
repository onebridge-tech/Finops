"use client";

import { useState, useTransition } from "react";
import { logReminder } from "@/app/actions/ledger";
import { buttonClass } from "@/components/ui";

/** Phase 1: WhatsApp click-to-chat. Phase 1 launch adds the WhatsApp Business API (IN-05). */
export function ReminderButton({ partyId, href, text, label = "Send WhatsApp reminder" }: { partyId: string; href: string | null; text: string; label?: string }) {
  const [pending, start] = useTransition();
  if (!href) {
    return <span className="self-center text-xs text-muted">Add a mobile number to send reminders</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => start(() => logReminder(partyId, text))}
      className={buttonClass("primary")}
      aria-busy={pending}
    >
      {label}
    </a>
  );
}

export function CopyLink({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary")}
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
