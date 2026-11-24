import { createPortal } from 'react-dom';
import { Layers, RotateCcw, Trash2, X } from 'lucide-react';

interface MultiSelectBarProps {
  count: number;
  inBinOrScratchpad?: boolean;
  onMoveToBin: () => void;
  onMoveToScratchpad: () => void;
  onRestore?: () => void;
  onClear: () => void;
}

export function MultiSelectBar({
  count,
  inBinOrScratchpad = false,
  onMoveToBin,
  onMoveToScratchpad,
  onRestore,
  onClear,
}: MultiSelectBarProps) {
  if (count <= 0) return null;

  return createPortal(
    <div
      role="region"
      aria-label="Multi-select actions"
      style={{
        position: 'fixed',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'rgba(14, 16, 15, 0.94)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          fontSize: 12,
          fontWeight: 600,
          color: '#f5f2eb',
        }}
      >
        <span>{count} selected</span>
        <button
          type="button"
          onClick={onClear}
          title="Exit multi-select (Esc)"
          aria-label="Clear selection"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'rgba(255,255,255,0.08)',
            color: '#d4d4d8',
            border: 0,
            cursor: 'pointer',
          }}
        >
          <X size={13} />
        </button>
      </div>

      {inBinOrScratchpad && onRestore ? (
        <button
          type="button"
          onClick={onRestore}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: 'rgba(16, 185, 129, 0.2)',
            color: '#6ee7b7',
            border: 0,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={15} />
          <span>Restore to Library</span>
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onMoveToBin}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: 'rgba(220, 38, 38, 0.28)',
              color: '#fca5a5',
              border: 0,
              borderRight: '1px solid rgba(255,255,255,0.1)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={15} />
            <span>Garbage Bin</span>
          </button>

          <button
            type="button"
            onClick={onMoveToScratchpad}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              background: 'rgba(37, 99, 235, 0.28)',
              color: '#93c5fd',
              border: 0,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Layers size={15} />
            <span>Scratchpad</span>
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
