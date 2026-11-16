"use client";

import { CHAPTERS } from "@/content/chapters";
import { useMission } from "@/lib/mission-state";

export function ChapterRail() {
  const { chapter, goToChapter, setFocus } = useMission();
  return (
    <ol className="space-y-1">
      {CHAPTERS.map((item, index) => (
        <li key={item.id}>
          <button
            type="button"
            className="w-full rounded border px-2 py-1 text-left text-xs"
            style={{
              borderColor: item.id === chapter ? "#d7b57a" : "#2a384c",
              color: item.id === chapter ? "#d7b57a" : "#93a4ba",
            }}
            onClick={() => {
              // Ensure panels stay revealed when visitor directly navigates chapters
              setFocus(false);
              goToChapter(item.id, item.goal, item.showStar);
            }}
          >
            {index + 1}. {item.label}
          </button>
        </li>
      ))}
    </ol>
  );
}
