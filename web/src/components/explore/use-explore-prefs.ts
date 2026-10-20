"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { companyName } from "@/lib/arka/normalize.mjs";

// One shared copy of favourites and dismissed results for every card on the page.
type Fav = { name: string; alerts: boolean; addedAt: string };
export type Prefs = { favourites: Fav[]; prioritizeFavourites: boolean; dismissed: string[] };
let state: Prefs | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const EMPTY: Prefs = { favourites: [], prioritizeFavourites: false, dismissed: [] };

function load() {
  loading ||= fetch("/api/arka/favourites", { cache: "no-store" }).then((r) => r.json()).then((j) => { state = j; emit(); }).catch(() => { state = EMPTY; emit(); });
  return loading;
}

export function useExplorePrefs() {
  const prefs = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state ?? EMPTY, () => EMPTY);
  useEffect(() => { void load(); }, []);
  const send = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch("/api/arka/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Could not save.");
    state = j; emit();
  }, []);
  const favSet = new Set(prefs.favourites.map((f) => f.name.toLowerCase()));
  const isFavourite = (company: string) => favSet.has(companyName(company).toLowerCase());
  return {
    prefs, isFavourite,
    toggleFavourite: (company: string) => send({ action: isFavourite(company) ? "remove" : "add", name: companyName(company) }),
    removeFavourite: (name: string) => send({ action: "remove", name }),
    setAlerts: (name: string, on: boolean) => send({ action: "alerts", name, on }),
    setPrioritize: (on: boolean) => send({ action: "prioritize", on }),
    dismiss: (url: string) => send({ action: "dismiss", url }),
    undismissAll: (urls: string[]) => send({ action: "undismiss", urls }),
  };
}
