"use client";

/** Signs out, first telling the offline cache to forget cached pages (FS-08). */
export function SignOutButton({ action, label }: { action: () => void | Promise<void>; label: string }) {
  return (
    <form action={action} onSubmit={() => { try { navigator.serviceWorker?.controller?.postMessage("clear"); } catch { /* no service worker */ } }}>
      <button className="hover:text-ink">{label}</button>
    </form>
  );
}
