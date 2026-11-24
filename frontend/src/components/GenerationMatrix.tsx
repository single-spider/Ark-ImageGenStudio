import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/** Full-canvas indeterminate activity. No image, card, or fabricated progress. */
export function GenerationMatrix({ model }: { model: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ columns: 30, rows: 20 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const columns = Math.max(8, Math.min(56, Math.round(entry.contentRect.width / 27)));
      const rows = Math.max(6, Math.min(40, Math.round(entry.contentRect.height / 27)));
      setSize((old) => old.columns === columns && old.rows === rows ? old : { columns, rows });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="ark-generation-field" role="status" aria-live="polite">
      <div className="ark-generation-field-dots" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${size.columns}, 1fr)`, gridTemplateRows: `repeat(${size.rows}, 1fr)` }}>
        {Array.from({ length: size.columns * size.rows }, (_, i) => {
          const x = i % size.columns, y = Math.floor(i / size.columns);
          const phase = Math.hypot(x - (size.columns - 1) / 2, y - (size.rows - 1) / 2) * .08 + ((i * 17) % 9) * .04;
          return <span key={i} className="ark-generation-dot" style={{ '--dot-delay': `${-phase}s` } as CSSProperties}/>;
        })}
      </div>
      <div className="ark-generation-field-status"><span className="status-dot"/> <strong>Generating image</strong><span>{model} · Mock preview</span></div>
    </div>
  );
}
