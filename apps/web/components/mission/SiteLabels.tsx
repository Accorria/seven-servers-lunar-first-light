"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useMission } from "@/lib/mission-state";
import { sitePoints } from "./site-points";

export type SiteLabelMap = Record<string, HTMLButtonElement | null>;

export const SiteLabelContext = createContext<MutableRefObject<SiteLabelMap> | null>(null);

export function SiteLabelProvider({ children }: { children: ReactNode }) {
  const labels = useRef<SiteLabelMap>({});
  return <SiteLabelContext.Provider value={labels}>{children}</SiteLabelContext.Provider>;
}

export function SiteLabels() {
  const labels = useContext(SiteLabelContext);
  const { siteId, setSiteId } = useMission();
  const points = useMemo(() => sitePoints(), []);
  const refCallbacks = useRef<Record<string, (node: HTMLButtonElement | null) => void>>({});

  const refFor = useCallback(
    (id: string) => {
      if (!refCallbacks.current[id]) {
        refCallbacks.current[id] = (node) => {
          if (labels) labels.current[id] = node;
          if (node) node.style.visibility = "hidden";
        };
      }
      return refCallbacks.current[id];
    },
    [labels],
  );

  if (!labels) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {points.map((site) => {
        const selected = site.id === siteId;
        return (
          <button
            key={site.id}
            type="button"
            ref={refFor(site.id)}
            onClick={(event) => {
              event.stopPropagation();
              setSiteId(site.id);
            }}
            className="pointer-events-auto absolute left-0 top-0 flex flex-col items-center bg-transparent px-1 py-0.5 text-[11px] uppercase tracking-[0.16em]"
            style={{ color: selected ? "#d7b57a" : "#d5deea" }}
          >
            {site.name}
            <span className="mt-1 h-2 w-px" style={{ background: selected ? "#d7b57a" : "#8fd8df" }} />
          </button>
        );
      })}
    </div>
  );
}
