/**
 * Adapted from Magic UI Lens (MIT).
 * https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/lens.tsx
 * Copyright (c) Magic UI. See THIRD_PARTY_NOTICES.md.
 *
 * Ark supplies its existing canvas pointer coordinates and keeps the lens
 * visually synchronized with the displayed image.
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface Position { x: number; y: number }

interface ArkImageLensProps {
  src: string;
  alt: string;
  position: Position | null;
  zoomFactor?: number;
  lensSize?: number;
}

export function ArkImageLens({
  src, alt, position, zoomFactor = 2, lensSize = 170,
}: ArkImageLensProps) {
  const reduceMotion = useReducedMotion();
  const maskImage = position
    ? `radial-gradient(circle ${lensSize / 2}px at ${position.x}% ${position.y}%, black 99%, transparent 100%)`
    : 'none';

  return (
    <div className="ark-lens-root">
      <img className="stage-image" src={src} alt={alt} draggable={false} />
      <AnimatePresence>
        {position && (
          <motion.div
            key="ark-lens-overlay"
            className="ark-lens-zoom"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.12 }}
            style={{ maskImage, WebkitMaskImage: maskImage }}
            aria-hidden="true"
          >
            <img
              className="stage-image"
              src={src}
              alt=""
              draggable={false}
              style={{
                transform: `scale(${zoomFactor})`,
                transformOrigin: `${position.x}% ${position.y}%`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {position && (
        <div
          className="ark-lens-ring"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: lensSize,
            height: lensSize,
          }}
          aria-hidden="true"
        >
          <span className="lens-crosshair" />
        </div>
      )}
    </div>
  );
}
