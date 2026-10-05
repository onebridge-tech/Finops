"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { lockNow, switchBranch, switchBusiness } from "@/app/actions/auth";

/** Business picker (LG-12). The last option goes to onboarding to add another business. */
export function BusinessSwitcher({ current, businesses }: { current: string; businesses: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <form action={switchBusiness}>
      <select
        key={current}
        name="businessId"
        defaultValue={current}
        aria-label="Business"
        className="max-w-48 truncate rounded-lg bg-transparent py-1 font-semibold outline-none hover:bg-bg"
        onChange={(e) => {
          if (e.currentTarget.value === "__new") router.push("/onboarding?new=1");
          else e.currentTarget.form?.requestSubmit();
        }}
      >
        {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        <option value="__new">+ Add another business</option>
      </select>
    </form>
  );
}

export function BranchSwitcher({ current, branches }: { current: string; branches: { id: string; name: string }[] }) {
  return (
    <form action={switchBranch}>
      <select
        key={current}
        name="branchId"
        defaultValue={current}
        aria-label="Branch"
        className="max-w-40 rounded-lg border border-line bg-card px-2 py-1 text-sm"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">All branches</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </form>
  );
}

/**
 * Locks the app after `minutes` without input (SE-03). The server also locks a
 * session idle that long, so closing the tab and coming back is covered too.
 */
export function IdleLock({ minutes }: { minutes: number }) {
  const last = useRef(0);
  useEffect(() => {
    last.current = Date.now();
    const bump = () => { last.current = Date.now(); };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last.current > minutes * 60_000) {
        clearInterval(timer);
        void lockNow();
      }
    }, 15_000);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [minutes]);
  return null;
}

export function LockButton() {
  return (
    <form action={lockNow}>
      <button title="Lock the app" aria-label="Lock the app" className="rounded-lg px-1.5 py-1 hover:bg-bg">🔒</button>
    </form>
  );
}
