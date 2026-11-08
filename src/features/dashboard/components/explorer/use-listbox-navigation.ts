import { useEffect, useRef, type KeyboardEvent } from "react";

/** Index of the row an arrow or Home/End key moves to. */
const TARGET_INDEX: Record<string, (index: number, lastIndex: number) => number> = {
  ArrowDown: (index, lastIndex) => Math.min(index + 1, lastIndex),
  ArrowUp: (index) => Math.max(index - 1, 0),
  Home: () => 0,
  End: (_index, lastIndex) => lastIndex,
};

/**
 * Keyboard behaviour of a listbox whose rows are `keys`: arrows, Home and End select and focus a row, Enter and
 * Space select the focused one. The active row keeps focus when the selection moves while focus is inside the list.
 */
export function useListboxNavigation(keys: string[], activeKey: string | null, onSelectKey: (key: string) => void) {
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!activeKey) return;
    const el = itemRefs.current.get(activeKey);
    if (el && document.activeElement && el.parentElement?.contains(document.activeElement)) el.focus();
  }, [activeKey]);

  function itemRef(key: string) {
    return (el: HTMLDivElement | null) => {
      if (el) itemRefs.current.set(key, el);
      else itemRefs.current.delete(key);
    };
  }

  function onKeyDown(e: KeyboardEvent, index: number) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const key = keys[index];
      if (key) onSelectKey(key);
      return;
    }
    const target = TARGET_INDEX[e.key];
    if (!target) return;
    e.preventDefault();
    const nextKey = keys[target(index, keys.length - 1)];
    if (!nextKey) return;
    onSelectKey(nextKey);
    itemRefs.current.get(nextKey)?.focus();
  }

  return { itemRef, onKeyDown };
}
