"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { inviteMember, updateMember } from "@/app/actions/team";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ROLES, ROLE_LABEL } from "@/lib/roles";

type Branch = { id: string; name: string };
type Member = { id: string; role: string; branchId: string; partyScope: string; maxDiscount: string };

function AccessFields({ branches, canAddOwner, member }: { branches: Branch[]; canAddOwner: boolean; member?: Member }) {
  const [role, setRole] = useState(member?.role ?? "BILLING");
  return (
    <>
      <Field label="Role" hint={ROLE_LABEL[role as keyof typeof ROLE_LABEL]?.about}>
        <Select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.filter((r) => canAddOwner || r !== "OWNER").map((r) => <option key={r} value={r}>{ROLE_LABEL[r].name}</option>)}
        </Select>
      </Field>
      <Field label="Branch">
        <Select name="branchId" defaultValue={member?.branchId ?? ""}>
          <option value="">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name} only</option>)}
        </Select>
      </Field>
      <Field label="Customers & suppliers" hint={role === "REP" ? "Field reps always see only their assigned parties" : undefined}>
        {role === "REP" ? (
          <>
            <input type="hidden" name="partyScope" value="ASSIGNED" />
            <Select disabled value="ASSIGNED"><option value="ASSIGNED">Only the customers given to them</option></Select>
          </>
        ) : (
          <Select name="partyScope" defaultValue={member?.partyScope ?? "ALL"}>
            <option value="ALL">Everyone</option>
            <option value="ASSIGNED">Only the customers given to them</option>
          </Select>
        )}
      </Field>
      <Field label="Max discount %" hint="Empty = no limit">
        <Input name="maxDiscount" inputMode="decimal" defaultValue={member?.maxDiscount ?? ""} />
      </Field>
    </>
  );
}

export function InviteForm({ branches, canAddOwner }: { branches: Branch[]; canAddOwner: boolean }) {
  const [state, action, pending] = useActionState(inviteMember, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-3">
      <Field label="Mobile number" hint="Enter a mobile number, an email, or both"><Input name="phone" inputMode="tel" placeholder="98480 12345" /></Field>
      <Field label="Email address"><Input name="email" type="email" inputMode="email" placeholder="name@example.com" /></Field>
      <Field label="Name"><Input name="name" /></Field>
      <AccessFields branches={branches} canAddOwner={canAddOwner} />
      <div className="space-y-2 sm:col-span-3">
        <ErrorText>{state.error}</ErrorText>
        {state.info && <p className="text-sm text-got">{state.info}</p>}
        <SubmitButton>Add to staff</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function MemberForm({ branches, canAddOwner, member }: { branches: Branch[]; canAddOwner: boolean; member: Member }) {
  const [state, action, pending] = useActionState(updateMember, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="membershipId" value={member.id} />
      <AccessFields branches={branches} canAddOwner={canAddOwner} member={member} />
      <div className="space-y-2 sm:col-span-4">
        <ErrorText>{state.error}</ErrorText>
        {state.info && <p className="text-sm text-got">{state.info}</p>}
        <SubmitButton variant="secondary">Save access</SubmitButton>
      </div>
    </ActionForm>
  );
}
