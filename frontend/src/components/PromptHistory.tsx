import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, Copy, History, RotateCcw, Search, X } from 'lucide-react';
import type { StudioAsset } from '../types/studio';
import { anchoredPosition } from '../lib/anchored-position';
import { readPromptHistory, type PromptEntry } from '../lib/prompt-history';
interface Props { anchor: HTMLButtonElement; assets: StudioAsset[]; onClose:()=>void; onRestore:(value:string)=>void; onSaveDraft:()=>void; onRestoreDraft:()=>void; onToast:(message:string,detail?:string)=>void; }
export function PromptHistory({anchor,assets,onClose,onRestore,onSaveDraft,onRestoreDraft,onToast}: Props) {
  const root=useRef<HTMLDivElement>(null);
  const search=useRef<HTMLInputElement>(null);
  const close=useRef(onClose); close.current=onClose;
  const [position,setPosition]=useState(()=>anchoredPosition(anchor,390,510));
  const [query,setQuery]=useState('');
  useLayoutEffect(()=>{
    const place=()=>setPosition(anchoredPosition(anchor,390,510));
    const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)&&!anchor.contains(e.target as Node))close.current();};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();close.current();anchor.focus();}};
    search.current?.focus();
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);
    return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);};
  },[anchor]);
  const entries:PromptEntry[]=[...readPromptHistory(),...assets.filter(a=>a.prompt.trim()).map(a=>({prompt:a.prompt,model:a.model,ratio:a.ratio,createdAt:a.createdAt,thumb:a.thumb}))];
  const unique=[...new Map(entries.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).map(e=>[e.prompt,e] as const).reverse()).values()].reverse().filter(e=>e.prompt.toLowerCase().includes(query.toLowerCase()));
  return createPortal(<div ref={root} className="ark-reference-picker ark-prompt-history" role="dialog" aria-label="Prompt history" style={position}>
    <header className="ark-ref-picker-head"><div><strong><History size={16}/> Prompt history</strong></div><button type="button" aria-label="Close prompt history" onClick={()=>{onClose();anchor.focus();}}><X size={17}/></button></header>
    <label className="ark-ref-picker-search"><Search size={15}/><input ref={search} aria-label="Search previous prompts" placeholder="Search previous prompts…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="ark-ref-picker-actions"><button type="button" onClick={onSaveDraft}><Bookmark size={13}/> Save draft</button><button type="button" onClick={onRestoreDraft}><RotateCcw size={13}/> Restore draft</button></div>
    <div className="ark-history-list">{unique.length?unique.map((entry,i)=><article key={i}>{entry.thumb&&<img src={entry.thumb} alt=""/>}<div><button type="button" className="ark-history-restore" aria-label={`Restore prompt ${i+1}`} onClick={()=>onRestore(entry.prompt)}>{entry.prompt}</button><small>{entry.model} · {entry.ratio}{entry.resolution?' · '+entry.resolution:''}</small></div><button type="button" className="text-icon-button" aria-label={`Copy prompt ${i+1}`} onClick={()=>{void navigator.clipboard.writeText(entry.prompt).then(()=>onToast('Prompt copied')).catch(()=>onToast('Clipboard unavailable'));}}><Copy size={15}/></button></article>):<p>No matching prompts.</p>}</div>
    <footer>{unique.length} prompts · Select to restore text</footer>
  </div>,document.body);
}
