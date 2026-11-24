import type { StudioAsset } from '../types/studio';
import { libraryAspect } from './library';

export interface MasonryRect {
  x: number;
  y: number;
  w: number;
  h: number;
  col: number;
}

export function solveOrganicMasonry(
  items: StudioAsset[],
  focusIdx: number,
  lastTileCol: Map<number, number>,
  width: number,
  cols: number,
  gap: number,
): { rects: MasonryRect[]; nextCols: Map<number, number>; totalH: number } {
  const n = items.length;
  const rects: MasonryRect[] = new Array(n);
  const nextCols = new Map<number, number>();
  if (n === 0 || width <= 0 || cols < 1) return { rects: [], nextCols, totalH: 0 };

  const colW = (width - gap * (cols - 1)) / cols;
  const colY = new Array<number>(cols).fill(0);

  const placeSingle = (idx: number, preferredCol = -1) => {
    const ar = Math.max(0.42, Math.min(2.3, libraryAspect(items[idx])));
    let c = preferredCol;
    if (c < 0 || c >= cols) {
      c = 0;
      for (let j = 1; j < cols; j++) {
        if (colY[j] < colY[c] - 2) c = j;
      }
    }
    const x = Math.round(c * (colW + gap));
    const w = Math.round(colW);
    const h = Math.round(w / ar);
    const y = colY[c];
    rects[idx] = { x, y, w, h, col: c };
    nextCols.set(idx, c);
    colY[c] = y + h + gap;
  };

  if (focusIdx < 0 || focusIdx >= n) {
    for (let i = 0; i < n; i++) placeSingle(i);
    return { rects, nextCols, totalH: Math.max(0, Math.max(...colY) - gap) };
  }

  const spanCols = Math.min(2, cols);
  const prevCol = lastTileCol.has(focusIdx) ? (lastTileCol.get(focusIdx) as number) : (focusIdx % cols);
  let spanCol = Math.min(prevCol, cols - spanCols);
  if (prevCol >= cols - 1) spanCol = cols - spanCols;

  const placed = new Set<number>();
  const takeNext = (startIdx: number) => {
    for (let j = startIdx; j < n; j++) {
      if (j !== focusIdx && !placed.has(j)) return j;
    }
    return -1;
  };

  for (let i = 0; i < focusIdx; i++) {
    if (placed.has(i)) continue;
    placeSingle(i);
    placed.add(i);
  }

  if (spanCols >= 2) {
    const cA = spanCol;
    const cB = spanCol + 1;
    if (Math.abs(colY[cA] - colY[cB]) > 140) {
      const shorter = colY[cA] < colY[cB] ? cA : cB;
      const filler = takeNext(focusIdx + 1);
      if (filler !== -1) {
        placeSingle(filler, shorter);
        placed.add(filler);
      }
    }
  }

  const fAr = Math.max(0.5, Math.min(2.3, libraryAspect(items[focusIdx])));
  const spanW = Math.round(colW * spanCols + gap * (spanCols - 1));
  const spanH = Math.round(spanW / fAr);
  const spanX = Math.round(spanCol * (colW + gap));
  let spanY = colY[spanCol];
  for (let c = spanCol + 1; c < spanCol + spanCols; c++) {
    spanY = Math.max(spanY, colY[c]);
  }

  rects[focusIdx] = { x: spanX, y: spanY, w: spanW, h: spanH, col: spanCol };
  nextCols.set(focusIdx, spanCol);
  for (let c = spanCol; c < spanCol + spanCols; c++) {
    colY[c] = spanY + spanH + gap;
  }
  placed.add(focusIdx);

  for (let i = 0; i < n; i++) {
    if (placed.has(i)) continue;
    placeSingle(i);
    placed.add(i);
  }

  return { rects, nextCols, totalH: Math.max(0, Math.max(...colY) - gap) };
}
