"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FieldDay } from "@/lib/field";
import type { FieldOp } from "@/lib/field-ops";
import { priceFor } from "@/lib/rules";
import { PAYMENT_MODES, PAYMENT_MODE_LABEL } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { attachPhoto } from "@/app/actions/field";
import { Card, Input, Select, buttonClass } from "@/components/ui";

type Pos = { lat: number; lng: number; accuracy: number } | null;
type Local = { openVisit: { clientId: string; partyId: string; partyName: string; since: string } | null; visited: Record<string, string>; dayStart: string | null; day: string };

const OUTCOMES = ["Order taken", "Payment collected", "Not available", "Follow-up needed", "Other"];
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(36).slice(2, 10)}`);

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: the app still works online */ }
}

/** Current position, or null when location is off, denied or takes too long. */
function getPosition(): Promise<Pos> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export function FieldApp({ data, businessId, userId }: { data: FieldDay; businessId: string; userId: string }) {
  const router = useRouter();
  const qKey = `blp.queue.${businessId}.${userId}`;
  const lKey = `blp.local.${businessId}.${userId}`;
  const [queue, setQueue] = useState<FieldOp[]>([]);
  const [local, setLocal] = useState<Local>({ openVisit: null, visited: {}, dayStart: null, day: data.today });
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "order" | "collect" | "checkout">(null);
  const [search, setSearch] = useState("");
  const flushing = useRef(false);

  // Load what was saved on this phone (it may include work not uploaded yet).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueue(read<FieldOp[]>(qKey, []));
    const l = read<Local | null>(lKey, null);
    setLocal(l && l.day === data.today ? l : { openVisit: null, visited: {}, dayStart: null, day: data.today });
    setOnline(navigator.onLine);
  }, [qKey, lKey, data.today]);

  const save = useCallback((q: FieldOp[], l: Local) => { write(qKey, q); write(lKey, l); }, [qKey, lKey]);

  const flush = useCallback(async (q: FieldOp[]) => {
    if (flushing.current || q.length === 0 || !navigator.onLine) return;
    flushing.current = true;
    try {
      const res = await fetch("/api/field/ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops: q }) });
      if (res.status === 401) { setMsg("Please sign in again to upload your work."); return; }
      const { results } = (await res.json()) as { results: { clientId: string; ok: boolean; error?: string }[] };
      const failed = new Map(results.filter((r) => !r.ok).map((r) => [r.clientId, r.error ?? "Failed"]));
      const rest = q.filter((op) => failed.has(op.clientId));
      setQueue(rest);
      write(qKey, rest);
      if (failed.size) setMsg(`${failed.size} item${failed.size === 1 ? "" : "s"} couldn’t be saved: ${[...failed.values()][0]}`);
      else setMsg(null);
      router.refresh();
    } catch {
      /* still offline or the server is unreachable; they stay queued */
    } finally {
      flushing.current = false;
    }
  }, [qKey, router]);

  // Upload when the connection comes back and on load.
  useEffect(() => {
    const on = () => { setOnline(true); void flush(read<FieldOp[]>(qKey, [])); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = setTimeout(() => void flush(read<FieldOp[]>(qKey, [])), 0);
    return () => { clearTimeout(t); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [flush, qKey]);

  const submit = async (op: FieldOp, nextLocal: Local = local) => {
    const q = [...queue, op];
    setQueue(q);
    setLocal(nextLocal);
    save(q, nextLocal);
    await flush(q);
  };

  const openVisit = local.openVisit ?? (data.openVisit?.clientId ? { clientId: data.openVisit.clientId, partyId: data.openVisit.partyId, partyName: data.openVisit.partyName, since: data.openVisit.since } : null);
  const visitedAt = (partyId: string) => local.visited[partyId] ?? data.plan.find((p) => p.partyId === partyId)?.visited?.at ?? data.todayVisits.find((v) => v.partyName === data.parties.find((x) => x.id === partyId)?.name)?.at;
  const partyOf = (id: string) => data.parties.find((p) => p.id === id);

  const startDay = async () => {
    setBusy(true);
    const pos = await getPosition();
    const at = new Date().toISOString();
    await submit({ kind: "DAYSTART", clientId: uid(), at, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) }, { ...local, dayStart: at });
    setMsg(pos ? null : "Day started without a location (location is off).");
    setBusy(false);
  };

  const checkIn = async (partyId: string) => {
    const p = partyOf(partyId);
    if (!p) return;
    setBusy(true);
    const pos = await getPosition();
    const at = new Date().toISOString();
    const clientId = uid();
    await submit(
      { kind: "CHECKIN", clientId, partyId, at, ...(pos ? { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : {}) },
      { ...local, openVisit: { clientId, partyId, partyName: p.name, since: at }, visited: { ...local.visited, [partyId]: at }, dayStart: local.dayStart ?? at },
    );
    setMsg(pos ? null : "Checked in without a location (location is off).");
    setBusy(false);
  };

  const checkOut = async (note: string, outcome: string) => {
    if (!openVisit) return;
    setBusy(true);
    const pos = await getPosition();
    await submit({ kind: "CHECKOUT", clientId: uid(), visitClientId: openVisit.clientId, at: new Date().toISOString(), note, outcome, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) }, { ...local, openVisit: null });
    setPanel(null);
    setBusy(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.parties.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.phone ?? "").includes(q)).slice(0, 30);
  }, [data.parties, search]);
  const plan = data.plan.filter((p) => partyOf(p.partyId));
  const dayStarted = local.dayStart ?? data.attendance?.at ?? null;
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>
          <span className="font-medium">{dayStarted ? `Day started ${time(dayStarted)}` : "Day not started"}</span>
          <span className="ml-3 text-xs">{online ? <span className="text-got">● online</span> : <span className="text-gave">● offline — saved on this phone</span>}</span>
          {queue.length > 0 && <span className="ml-3 rounded-full bg-gave px-2 py-0.5 text-xs font-semibold text-white">{queue.length} waiting to upload</span>}
        </span>
        <span className="flex items-center gap-2">
          {queue.length > 0 && <button className={buttonClass("secondary")} onClick={() => flush(queue)} disabled={!online}>Upload now</button>}
          {!dayStarted && <button className={buttonClass("primary")} onClick={startDay} disabled={busy}>Start my day</button>}
          {dayStarted && online && <SelfieButton />}
        </span>
      </Card>
      {msg && <p role="status" className="rounded-lg bg-gave/10 px-3 py-2 text-sm text-gave">{msg}</p>}

      {openVisit && (
        <Card className="space-y-3 border-brand/50">
          <p className="text-xs uppercase text-muted">At a customer since {time(openVisit.since)}</p>
          <h2 className="text-lg font-semibold">{openVisit.partyName}</h2>
          <div className="flex flex-wrap gap-2">
            <button className={buttonClass(panel === "order" ? "primary" : "secondary")} onClick={() => setPanel(panel === "order" ? null : "order")}>Take order</button>
            <button className={buttonClass(panel === "collect" ? "primary" : "secondary")} onClick={() => setPanel(panel === "collect" ? null : "collect")}>Collect payment</button>
            <button className={buttonClass(panel === "checkout" ? "primary" : "secondary")} onClick={() => setPanel(panel === "checkout" ? null : "checkout")}>Check out</button>
          </div>
          {panel === "order" && <OrderPanel data={data} partyId={openVisit.partyId} onDone={async (lines, note) => { await submit({ kind: "ORDER", clientId: uid(), partyId: openVisit.partyId, visitClientId: openVisit.clientId, note, lines }); setPanel(null); setMsg("Order saved."); }} />}
          {panel === "collect" && <CollectPanel onDone={async (amount, mode, note) => { await submit({ kind: "COLLECTION", clientId: uid(), partyId: openVisit.partyId, amount, mode, note, at: new Date().toISOString() }); setPanel(null); setMsg("Payment saved. The receipt goes to the customer when it uploads."); }} />}
          {panel === "checkout" && <CheckoutPanel busy={busy} onDone={checkOut} />}
        </Card>
      )}

      {!openVisit && (
        <>
          <section>
            <h2 className="mb-2 font-semibold">Today’s route</h2>
            {plan.length === 0 ? <Card className="text-sm text-muted">No route is planned for today. You can still check in at any customer below.</Card> : (
              <Card className="divide-y divide-line p-0 text-sm">
                {plan.map((p, i) => {
                  const party = partyOf(p.partyId)!;
                  const at = visitedAt(p.partyId);
                  return (
                    <div key={p.partyId} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span>
                        <span className="font-medium">{i + 1}. {party.name}</span>
                        <span className="block text-xs text-muted">{p.beat}{party.address && ` · ${party.address}`}{party.balance > 0 && ` · owes ${formatINR(party.balance)}`}</span>
                      </span>
                      {at ? <span className="text-xs text-got">✓ visited {time(at)}</span> : <button className={buttonClass("primary")} disabled={busy} onClick={() => checkIn(p.partyId)}>Check in</button>}
                    </div>
                  );
                })}
              </Card>
            )}
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Any customer</h2>
            <Input placeholder="Search by name or phone" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
            <Card className="divide-y divide-line p-0 text-sm">
              {filtered.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span>{p.name}<span className="block text-xs text-muted">{p.phone ? `+${p.phone}` : "no phone"}{p.balance > 0 && ` · owes ${formatINR(p.balance)}`}</span></span>
                  <button className={buttonClass("secondary")} disabled={busy} onClick={() => checkIn(p.id)}>Check in</button>
                </div>
              ))}
              {filtered.length === 0 && <p className="px-4 py-3 text-muted">No match.</p>}
            </Card>
          </section>
        </>
      )}

      {data.todayVisits.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Today’s visits</h2>
          <Card className="divide-y divide-line p-0 text-sm">
            {data.todayVisits.map((v) => (
              <div key={v.id} className="flex justify-between gap-3 px-4 py-2">
                <span>{v.partyName}<span className="block text-xs text-muted">{time(v.at)}{v.out && ` – ${time(v.out)}`}{v.outcome && ` · ${v.outcome}`}</span></span>
                {v.distanceM !== null && <span className={`text-xs ${v.distanceM > 200 ? "text-gave" : "text-muted"}`}>{v.distanceM} m from saved location</span>}
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function OrderPanel({ data, partyId, onDone }: { data: FieldDay; partyId: string; onDone: (lines: { itemId: string; qty: number }[], note: string) => Promise<void> }) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");
  const party = data.parties.find((p) => p.id === partyId);
  const rows = party?.priceListId ? (data.priceRows[party.priceListId] ?? []) : [];
  const picks = data.items.map((i) => ({ i, q: Number(qty[i.id]) || 0 })).filter((x) => x.q > 0);
  const total = picks.reduce((s, { i, q }) => s + Math.round(priceFor(rows, i.id, Math.round(q * 1000), i.ratePaise) * q * (1 + i.taxRateBp / 10000)), 0);
  const shown = data.items.filter((i) => !filter || i.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-2">
      <Input placeholder="Find an item" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <ul className="max-h-72 divide-y divide-line overflow-auto rounded-lg border border-line text-sm">
        {shown.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span>{i.name}<span className="block text-xs text-muted">{formatINR(priceFor(rows, i.id, Math.round((Number(qty[i.id]) || 1) * 1000), i.ratePaise))} / {i.unit}</span></span>
            <Input inputMode="decimal" placeholder="Qty" className="w-20" aria-label={`Quantity of ${i.name}`} value={qty[i.id] ?? ""} onChange={(e) => setQty((s) => ({ ...s, [i.id]: e.target.value }))} />
          </li>
        ))}
      </ul>
      <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{picks.length} item{picks.length === 1 ? "" : "s"} · about {formatINR(total)} with GST</span>
        <button className={buttonClass("primary")} disabled={picks.length === 0} onClick={() => onDone(picks.map(({ i, q }) => ({ itemId: i.id, qty: q })), note)}>Save order</button>
      </div>
    </div>
  );
}

function CollectPanel({ onDone }: { onDone: (amount: string, mode: string, note: string) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [note, setNote] = useState("");
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <Input inputMode="decimal" placeholder="Amount ₹" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
      <Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Paid by">{PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}</Select>
      <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className={buttonClass("primary")} disabled={!/^\d+(\.\d{1,2})?$/.test(amount.replace(/,/g, ""))} onClick={() => onDone(amount, mode, note)}>Save payment</button>
    </div>
  );
}

function CheckoutPanel({ busy, onDone }: { busy: boolean; onDone: (note: string, outcome: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      <Select value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label="Outcome">{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</Select>
      <div className="sm:col-span-2"><Input placeholder="Visit note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <button className={buttonClass("primary")} disabled={busy} onClick={() => onDone(note, outcome)}>Check out</button>
    </div>
  );
}

/** Optional day-start selfie, uploaded while online (FS-07). */
function SelfieButton() {
  const [state, setState] = useState<string | null>(null);
  return (
    <label className="cursor-pointer text-xs text-muted underline">
      {state ?? "Add selfie"}
      <input type="file" accept="image/*" capture="user" className="sr-only" onChange={async (e) => {
        const f = e.currentTarget.files?.[0];
        if (!f) return;
        const fd = new FormData();
        fd.set("target", "attendance");
        fd.set("file", f);
        const r = await attachPhoto(fd);
        setState(r.error ?? "Selfie added ✓");
      }} />
    </label>
  );
}
