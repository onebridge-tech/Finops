"use client";

import { createContext, startTransition, useContext, type ComponentProps } from "react";

export const PendingContext = createContext(false);
export const usePending = () => useContext(PendingContext);

/**
 * Submits to a useActionState dispatcher inside a transition instead of via the
 * native `action` prop. React resets uncontrolled fields after a native form
 * action, which would wipe the user's input whenever validation fails.
 */
export function ActionForm({ dispatch, pending, ...props }: Omit<ComponentProps<"form">, "action" | "onSubmit"> & { dispatch: (f: FormData) => void; pending: boolean }) {
  return (
    <PendingContext.Provider value={pending}>
      <form
        {...props}
        onSubmit={(e) => {
          e.preventDefault();
          // Include the clicked button's name/value, as a native submit would.
          const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          startTransition(() => dispatch(data));
        }}
      />
    </PendingContext.Provider>
  );
}
