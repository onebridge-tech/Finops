"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui";

/** A password box with a Show / Hide button. */
export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <span className="relative block">
      <Input {...props} type={shown ? "text" : "password"} className="pr-16" />
      <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-muted hover:text-ink">
        {shown ? "Hide" : "Show"}
      </button>
    </span>
  );
}
