import { useEffect, useState, type RefObject } from 'react';

export function useElementSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (width: number, height: number) =>
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width, entry.contentRect.height));
    observer.observe(el);
    const rect = el.getBoundingClientRect();
    update(rect.width, rect.height);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
