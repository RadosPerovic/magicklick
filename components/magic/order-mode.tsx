"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const OrderModeContext = createContext({ live: false, ready: false });

export function OrderModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState({ live: false, ready: false });
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/orders", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("mode_unavailable");
        const result = await response.json();
        setMode({ live: !!result && typeof result === "object" && "enabled" in result && result.enabled === true, ready: true });
      })
      .catch(() => { if (!controller.signal.aborted) setMode({ live: false, ready: true }); });
    return () => controller.abort();
  }, []);
  return <OrderModeContext.Provider value={mode}>{children}</OrderModeContext.Provider>;
}

export function useOrderMode() { return useContext(OrderModeContext); }
