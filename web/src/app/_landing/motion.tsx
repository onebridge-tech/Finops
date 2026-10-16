"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fades and lifts its content into place the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`lp-reveal ${on ? "lp-in" : ""} ${className}`}>{children}</div>;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A rupee amount that counts up (or down) to its new value whenever `to` changes. */
export function Money({ to, className = "" }: { to: number; className?: string }) {
  const [shown, setShown] = useState(to);
  const from = useRef(to);
  useEffect(() => {
    const start = from.current;
    if (start === to || reduced()) { from.current = to; setShown(to); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start + (to - start) * eased);
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span className={`tabular-nums ${className}`}>₹{shown.toLocaleString("en-IN")}</span>;
}
