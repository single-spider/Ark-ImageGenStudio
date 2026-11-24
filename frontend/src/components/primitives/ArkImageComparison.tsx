/**
 * Adapted from Motion Primitives Image Comparison (MIT).
 * https://github.com/ibelick/motion-primitives/blob/main/components/core/image-comparison.tsx
 * Copyright (c) 2024 ibelick. See THIRD_PARTY_NOTICES.md.
 *
 * Ark adds pointer capture, keyboard slider semantics, controllable A/B content,
 * and a reveal that remains inside the existing image viewport.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

interface ArkImageComparisonProps {
  baseSrc: string;
  revealSrc: string;
  baseLabel: string;
  revealLabel: string;
}

export function ArkImageComparison({
  baseSrc,
  revealSrc,
  baseLabel,
  revealLabel,
}: ArkImageComparisonProps) {
  const dragging = useRef(false);
  const reduceMotion = useReducedMotion();
  const [position, setPosition] = useState(50);
  const rawPosition = useMotionValue(50);
  const springPosition = useSpring(rawPosition, { stiffness: 430, damping: 42, mass: 0.7 });
  const motionPosition = reduceMotion ? rawPosition : springPosition;
  const clipPath = useTransform(motionPosition, (value) => `inset(0 ${100 - value}% 0 0)`);
  const left = useTransform(motionPosition, (value) => `${value}%`);

  function move(value: number) {
    const next = Math.max(0, Math.min(100, value));
    rawPosition.set(next);
    setPosition(next);
  }

  useEffect(() => {
    move(50);
    // A new pair always begins with a 50/50 reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSrc, revealSrc]);

  function updateFromPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    move(((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100);
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current) updateFromPointer(event);
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown': next = position - (event.shiftKey ? 10 : 1); break;
      case 'ArrowRight':
      case 'ArrowUp': next = position + (event.shiftKey ? 10 : 1); break;
      case 'PageDown': next = position - 10; break;
      case 'PageUp': next = position + 10; break;
      case 'Home': next = 0; break;
      case 'End': next = 100; break;
    }
    if (next !== null) {
      event.preventDefault();
      event.stopPropagation();
      move(next);
    }
  }

  return (
    <div
      className="ark-comparison"
      onPointerDown={beginDrag}
      onPointerMove={drag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      aria-label="Interactive before and after image comparison"
    >
      <img className="stage-image" src={baseSrc} alt={baseLabel} draggable={false} />
      <motion.img
        className="stage-image ark-reveal-image"
        src={revealSrc}
        alt={revealLabel}
        style={{ clipPath }}
        draggable={false}
      />
      <motion.div
        className="compare-control"
        style={{ left }}
        role="slider"
        tabIndex={0}
        aria-label="Image comparison split"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`Showing ${Math.round(position)} percent of ${revealLabel}`}
        onKeyDown={handleKeys}
      >
        <span className="compare-label compare-label-a">B / {revealLabel}</span>
        <span className="compare-line" />
        <span className="compare-handle" aria-hidden="true">↔</span>
        <span className="compare-label compare-label-b">A / {baseLabel}</span>
      </motion.div>
    </div>
  );
}
