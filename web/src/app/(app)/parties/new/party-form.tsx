"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState } from "react";
import { createParty, updateParty } from "@/app/actions/ledger";
import { GstinLookupButton } from "@/components/gstin-lookup";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { STATES } from "@/lib/gstin";
import { LANGUAGE_NAMES } from "@/lib/messaging/templates";

export type PartyValues = {
  id: string; name: string; type: string; phone: string; email: string; gstin: string; stateCode: string; address: string;
  creditDays: string; creditLimit: string; language: string; source: string; ownerId: string; branchId: string; priceListId: string;
};

type Opt = { id: string; name: string };

type Props = {
  defaultState: string;
  party?: PartyValues; // edit mode when present
  owners: Opt[] | null; // null = this member can't assign parties
  branches: Opt[] | null; // null = branch is fixed for this member
  defaultBranch?: string;
  priceLists?: Opt[];
};

export function PartyForm({ defaultState, party, owners, branches, defaultBranch = "", priceLists = [] }: Props) {
  const [state, action, pending] = useActionState(party ? updateParty : createParty, {});
  const v = party;

  return (
    <ActionForm dispatch={action} pending={pending} className="grid gap-4 sm:grid-cols-2">
      {v && <input type="hidden" name="partyId" value={v.id} />}
      <div className="sm:col-span-2">
        <Field label="Name"><Input name="name" required autoFocus={!v} defaultValue={v?.name} placeholder="Lakshmi General Stores" /></Field>
      </div>
      <Field label="Type">
        <Select name="type" defaultValue={v?.type ?? "CUSTOMER"}>
          <option value="CUSTOMER">Customer</option>
          <option value="SUPPLIER">Supplier</option>
          <option value="BOTH">Customer & supplier</option>
          <option value="LEAD">Possible customer</option>
        </Select>
      </Field>
      <Field label="Mobile (for WhatsApp reminders)"><Input name="phone" inputMode="tel" defaultValue={v?.phone ? `+${v.phone}` : ""} placeholder="98480 12345" /></Field>
      <Field label="GSTIN (optional)" hint="Their 15-letter GST number, if they have one. Then the bill shows it, and we can fill the name and state for you.">
        <span className="flex flex-wrap gap-2">
          <Input name="gstin" maxLength={15} className="flex-1 uppercase" defaultValue={v?.gstin} />
          <GstinLookupButton />
        </span>
      </Field>
      <Field label="State" hint="If their state is different from yours, the bill uses IGST instead of CGST and SGST.">
        <Select name="stateCode" defaultValue={v?.stateCode || defaultState}>
          {Object.entries(STATES).map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
        </Select>
      </Field>
      <Field label="Email"><Input name="email" type="email" defaultValue={v?.email} /></Field>
      <Field label="Days to pay" hint="How many days they usually take to pay. The due date on each credit is set from this, and reminders start from it.">
        <Input name="creditDays" inputMode="numeric" placeholder="30" defaultValue={v?.creditDays} />
      </Field>
      <Field label="Credit limit (₹)" hint="The most they can owe you at one time. If a new bill goes above it, the app can warn you or stop it. Turn this on in Settings, Credit & summary.">
        <Input name="creditLimit" inputMode="decimal" defaultValue={v?.creditLimit} />
      </Field>
      {priceLists.length > 0 && (
        <Field label="Special price list" hint="Rates and quantity slabs fill in on documents for this party">
          <Select name="priceListId" defaultValue={v?.priceListId ?? ""}>
            <option value="">Normal prices</option>
            {priceLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Message language" hint="Reminders and receipts for this person are written in this language.">
        <Select name="language" defaultValue={v?.language ?? "en"}>
          {Object.entries(LANGUAGE_NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </Select>
      </Field>
      <Field label="Source" hint="How they found you, for example walk-in or a friend’s name. Only for your own records."><Input name="source" defaultValue={v?.source} /></Field>
      {owners && (
        <Field label="Assigned to" hint="The staff member who looks after this customer. A salesman can only see customers given to him.">
          <Select name="ownerId" defaultValue={v?.ownerId ?? ""}>
            <option value="">Nobody in particular</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
      )}
      {branches && branches.length > 0 && (
        <Field label="Branch" hint="Which of your shops this customer belongs to. “Shared” means every branch can see them.">
          <Select name="branchId" defaultValue={v ? v.branchId : defaultBranch}>
            <option value="">Shared by all branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      )}
      <div className="sm:col-span-2"><Field label="Address"><Input name="address" defaultValue={v?.address} /></Field></div>
      {!v && (
        <>
          <Field label="Already pending before using this app (₹)" hint="If they already owed you (or you owed them) before today, put that amount here once. It becomes their starting balance."><Input name="opening" inputMode="decimal" placeholder="0" /></Field>
          <Field label="This amount is">
            <Select name="openingDirection" defaultValue="GAVE">
              <option value="GAVE">They owe me</option>
              <option value="GOT">I owe them</option>
            </Select>
          </Field>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-[var(--brand)]" />
            <span>
              This party agreed to receive account messages (reminders, receipts, invoices) on WhatsApp, SMS or email.
              <span className="block text-xs text-muted">Needed before we can message them. They can stop messages any time from a link in each message.</span>
            </span>
          </label>
        </>
      )}
      <div className="space-y-3 sm:col-span-2">
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton>{v ? "Save changes" : "Save"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
