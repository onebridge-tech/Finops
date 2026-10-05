"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { saveDashboardTiles } from "@/app/actions/team";
import { SubmitButton } from "@/components/submit-button";
import { TILES, type TileId } from "@/lib/tiles";

/** Choose and order dashboard tiles. Unticked tiles keep their place at the bottom. */
export function CustomizeTiles({ current, available, label }: { current: TileId[]; available: TileId[]; label: string }) {
  const [state, action, pending] = useActionState(saveDashboardTiles, {});
  const [order, setOrder] = useState<TileId[]>(() => [...current.filter((t) => available.includes(t)), ...available.filter((t) => !current.includes(t))]);
  const [on, setOn] = useState<Set<TileId>>(() => new Set(current));
  const move = (i: number, d: -1 | 1) => setOrder((o) => {
    const j = i + d;
    if (j < 0 || j >= o.length) return o;
    const n = [...o];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted underline">{label}</summary>
      <ActionForm dispatch={action} pending={pending} className="mt-2 w-72 space-y-2 rounded-xl border border-line bg-card p-3 shadow-lg">
        <ul className="space-y-1">
          {order.map((id, i) => (
            <li key={id} className="flex items-center gap-2">
              <input type="checkbox" checked={on.has(id)} aria-label={TILES[id].label} className="size-4 accent-[var(--brand)]"
                onChange={(e) => setOn((s) => { const n = new Set(s); if (e.target.checked) n.add(id); else n.delete(id); return n; })} />
              <span className="flex-1">{TILES[id].label}</span>
              <button type="button" onClick={() => move(i, -1)} aria-label={`Move ${TILES[id].label} up`} className="px-1 text-muted hover:text-ink">↑</button>
              <button type="button" onClick={() => move(i, 1)} aria-label={`Move ${TILES[id].label} down`} className="px-1 text-muted hover:text-ink">↓</button>
              {on.has(id) && <input type="hidden" name="tile" value={id} />}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <SubmitButton>Save</SubmitButton>
          <button name="reset" value="1" className="text-xs text-muted underline">Reset to default</button>
          {state.info && <span className="text-xs text-got">{state.info}</span>}
        </div>
      </ActionForm>
    </details>
  );
}
