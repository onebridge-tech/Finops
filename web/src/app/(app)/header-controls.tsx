"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { lockNow, switchBranch, switchBusiness } from "@/app/actions/auth";
import { setLanguage } from "@/app/actions/team";
import { UI_LANGUAGES } from "@/lib/i18n";
import { Icon } from "@/components/icon";

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
        className="w-full max-w-full cursor-pointer truncate rounded-lg border border-line bg-card px-2.5 py-2 text-sm font-semibold shadow-sm outline-none hover:bg-bg focus-visible:border-brand"
        onChange={(e) => {
          if (e.currentTarget.value === "__new") router.push("/onboarding?new=1");
          else e.currentTarget.form?.requestSubmit();
        }}
      >
        {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        <option value="__new">+ Add another shop</option>
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
        className="max-w-40 cursor-pointer rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm shadow-sm outline-none focus-visible:border-brand"
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
      <button title="Lock the app" aria-label="Lock the app" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-ink"><Icon name="lock" size={18} /></button>
    </form>
  );
}

/** Always-visible language picker. Names are written in their own script so a person who cannot read the current language can still find theirs. */
export function LanguageSwitcher({ current }: { current: string }) {
  return (
    <form action={setLanguage} translate="no" className="relative">
      <Icon name="globe" size={16} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
      <select
        key={current}
        name="uiLanguage"
        defaultValue={current}
        aria-label="Language / భాష / भाषा / மொழி / ಭಾಷೆ"
        title="Language / భాష / भाषा / மொழி / ಭಾಷೆ"
        className="h-9 cursor-pointer rounded-lg border border-line bg-card py-0 pl-7 pr-1.5 text-sm font-medium shadow-sm outline-none hover:bg-bg focus-visible:border-brand"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {Object.entries(UI_LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select>
    </form>
  );
}
