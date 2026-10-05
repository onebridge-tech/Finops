"use client";

import type { ReactNode } from "react";
import { buttonClass } from "./ui";
import { usePending } from "./action-form";

export function SubmitButton({ children, variant = "primary", className = "" }: { children: ReactNode; variant?: "primary" | "secondary" | "danger"; className?: string }) {
  const pending = usePending();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, className)}>
      {pending ? "Saving…" : children}
    </button>
  );
}
