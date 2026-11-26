/** Prefer the side facing the actual canvas, regardless of the panel's grid position. */
export function anchoredPosition(anchor: HTMLElement, preferredWidth: number, preferredHeight: number) {
  const rect=anchor.getBoundingClientRect();
  const panel=anchor.closest('.controls-panel')?.getBoundingClientRect() ?? rect;
  const canvas=document.querySelector('.image-stage')?.getBoundingClientRect();
  const width=Math.min(preferredWidth,window.innerWidth-24);
  const height=Math.min(preferredHeight,window.innerHeight-24);
  const right=panel.right+10;
  const left=panel.left-width-10;
  const inwardRight=canvas ? canvas.left+canvas.width/2 >= panel.left+panel.width/2 : panel.left < window.innerWidth/2;
  const choices=inwardRight?[right,left]:[left,right];
  return { left: choices.find(x=>x>=12 && x+width<=window.innerWidth-12) ?? Math.max(12,Math.min(rect.left,window.innerWidth-width-12)), top: Math.max(12,Math.min(rect.top,window.innerHeight-height-12)),width,height };
}
