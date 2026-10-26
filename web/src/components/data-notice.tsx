import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icon";

/**
 * The short notice shown wherever the app asks for personal data (Digital Personal Data Protection Act, 2023, s. 5):
 * why it is needed, how long it is kept, who else sees it, and where to change your mind. Plain words, one line
 * visible, the rest a tap away, with links to the full Privacy Policy and to deleting the account.
 */
export function DataNotice({ why, keep, shared, children, className = "" }: { why: ReactNode; keep?: ReactNode; shared?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-bg/40 px-3 py-2.5 text-xs leading-relaxed text-muted ${className}`}>
      <p className="flex gap-2">
        <Icon name="lock" size={14} className="mt-0.5 shrink-0 text-brand" />
        <span><span className="font-medium text-ink">Why we ask: </span>{why}</span>
      </p>
      {(keep || shared || children) && (
        <details className="mt-1.5 pl-[22px]">
          <summary className="cursor-pointer select-none text-brand">How long we keep it and your choices</summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {keep && <li><span className="font-medium text-ink">Kept: </span>{keep}</li>}
            {shared && <li><span className="font-medium text-ink">Who sees it: </span>{shared}</li>}
            {children}
            <li>
              You can see, correct or download it any time, or delete your account.{" "}
              <Link className="text-brand underline" href="/privacy">Privacy Policy</Link>
            </li>
          </ul>
        </details>
      )}
    </div>
  );
}
