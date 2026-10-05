"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { translator, type T } from "@/lib/i18n";

const Ctx = createContext<{ t: T; mode: string }>({ t: translator("en"), mode: "SIMPLE" });

/** Makes the signed-in user's language and view mode available to client components. */
export function I18nProvider({ lang, mode, children }: { lang: string; mode: string; children: ReactNode }) {
  const value = useMemo(() => ({ t: translator(lang), mode }), [lang, mode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx).t;
export const useMode = () => useContext(Ctx).mode;
