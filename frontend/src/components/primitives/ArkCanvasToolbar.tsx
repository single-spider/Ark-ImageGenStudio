import type { ReactNode } from 'react';
/** Shared continuous surface for canvas navigation and contextual tools. */
export function ArkCanvasToolbar({label,children}:{label:string;children:ReactNode}) {
  return <div className="ark-canvas-toolbar" role="group" aria-label={label}>{children}</div>;
}
export function CanvasToolbarGroup({children}:{children:ReactNode}) {
  return <div className="ark-canvas-toolbar-group">{children}</div>;
}
export function CanvasToolbarDivider() {
  return <span className="ark-canvas-toolbar-divider" aria-hidden="true"/>;
}
