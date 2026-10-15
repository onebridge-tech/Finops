"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markSent, removeFromOutbox } from "@/app/actions/outbox";
import { Avatar } from "@/components/ui";
import { Icon } from "@/components/icon";

type Props = { id: string; name: string; kind: string; preview: string; when: string; href: string | null; partyHref: string | null };

/** One message waiting to be sent. Send opens WhatsApp with the text ready, then moves it out of the list. */
export function OutboxRow({ id, name, kind, preview, when, href, partyHref }: Props) {
  const [gone, setGone] = useState(false);
  const [, start] = useTransition();
  if (gone) return null;
  return (
    <div className="flex flex-wrap items-start gap-3 px-4 py-3.5">
      <Avatar name={name} size={38} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          {partyHref ? <Link href={partyHref} className="font-medium hover:underline">{name}</Link> : <span className="font-medium">{name}</span>}
          <span className="text-xs text-muted">{kind} · {when}</span>
        </p>
        <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted">{preview}</p>
        {!href && <p className="mt-1 text-xs text-gave">No valid mobile number, so this can’t be opened in WhatsApp.</p>}
      </div>
      <div className="flex w-full items-center gap-3 sm:w-auto">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { setGone(true); start(() => markSent(id)); }}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#16a34a] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-110 sm:flex-none"
          >
            <Icon name="send" size={16} />Send on WhatsApp
          </a>
        )}
        <button type="button" onClick={() => { setGone(true); start(() => removeFromOutbox(id)); }} className="text-sm text-muted underline hover:text-gave">Remove</button>
      </div>
    </div>
  );
}
