"use client";

import { Icon } from "@/components/icon";
import { buttonClass } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-gave/10 text-gave"><Icon name="warning" size={26} /></span>
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-1.5 text-sm text-muted">Nothing was lost. Please try again. If it keeps happening, tell us what you were doing.</p>
      <button onClick={reset} className={`${buttonClass("primary")} mt-6`}>Try again</button>
    </main>
  );
}
