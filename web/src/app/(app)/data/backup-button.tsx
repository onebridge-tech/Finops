"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { backupNow } from "@/app/actions/data";
import { SubmitButton } from "@/components/submit-button";

export function BackupButton() {
  const [state, action, pending] = useActionState(backupNow, {});
  return (
    <ActionForm dispatch={() => action()} pending={pending} className="space-y-2">
      <SubmitButton variant="secondary">Save a backup now</SubmitButton>
      {state.info && <p className="text-sm text-got">{state.info}</p>}
      {state.error && <p className="text-sm text-gave">{state.error}</p>}
    </ActionForm>
  );
}
