"use client";

/** Signs out, first telling the offline cache to forget cached pages (FS-08). */
export function SignOutButton({ action, label, className = "hover:text-ink", children }: { action: () => void | Promise<void>; label: string; className?: string; children?: React.ReactNode }) {
  return (
    <form action={action} onSubmit={() => { try { navigator.serviceWorker?.controller?.postMessage("clear"); } catch { /* no service worker */ } }}>
      <button className={className} title={label} aria-label={label}>{children ?? label}</button>
    </form>
  );
}
