import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { Toaster } from "sonner";
import { useStudioStore } from "./stores/useStudioStore";
import { MainImageWindow } from "./components/zones/MainImageWindow";
import { ReferencesZone } from "./components/zones/ReferencesZone";
import { ContextualDeckZone } from "./components/zones/ContextualDeckZone";
import { ModelSettingsStrip } from "./components/zones/ModelSettingsStrip";
import { PromptStudioZone } from "./components/zones/PromptStudioZone";
import { MiniGalleryExplorer } from "./components/zones/MiniGalleryExplorer";
import { FullViewportGalleryModal } from "./components/overlays/FullViewportGalleryModal";
import { CommandPalette } from "./components/overlays/CommandPalette";
import { PrivacyCover } from "./components/overlays/PrivacyCover";

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

export function App() {
  const initStudio = useStudioStore((s) => s.initStudio);
  const wideCanvas = useStudioStore((s) => s.wideCanvas);
  const setWideCanvas = useStudioStore((s) => s.setWideCanvas);
  const canvasMode = useStudioStore((s) => s.canvasMode);
  const maximizedMiddleZone = useStudioStore((s) => s.maximizedMiddleZone);
  const autoFlexSignal = useStudioStore((s) => s.autoFlexSignal);

  const col3PanelRef = usePanelRef();
  const z2PanelRef = usePanelRef();
  const z3PanelRef = usePanelRef();
  const z5PanelRef = usePanelRef();

  const [isMainProgrammaticResize, setIsMainProgrammaticResize] =
    useState(false);
  const [isMiddleProgrammaticResize, setIsMiddleProgrammaticResize] =
    useState(false);

  const mainResizeTimerRef = useRef<number | null>(null);
  const middleResizeTimerRef = useRef<number | null>(null);
  const hasMountedAutoFlexRef = useRef(false);

  const triggerMainSmoothResize = useCallback(() => {
    setIsMainProgrammaticResize(true);
    if (mainResizeTimerRef.current !== null) {
      window.clearTimeout(mainResizeTimerRef.current);
    }
    mainResizeTimerRef.current = window.setTimeout(() => {
      setIsMainProgrammaticResize(false);
      mainResizeTimerRef.current = null;
    }, 210);
  }, []);

  const triggerMiddleSmoothResize = useCallback(() => {
    setIsMiddleProgrammaticResize(true);
    if (middleResizeTimerRef.current !== null) {
      window.clearTimeout(middleResizeTimerRef.current);
    }
    middleResizeTimerRef.current = window.setTimeout(() => {
      setIsMiddleProgrammaticResize(false);
      middleResizeTimerRef.current = null;
    }, 210);
  }, []);

  // Initialize studio workspace on mount
  useEffect(() => {
    void initStudio();
  }, [initStudio]);

  // Cleanup resize timers on unmount
  useEffect(() => {
    return () => {
      if (mainResizeTimerRef.current !== null) {
        window.clearTimeout(mainResizeTimerRef.current);
      }
      if (middleResizeTimerRef.current !== null) {
        window.clearTimeout(middleResizeTimerRef.current);
      }
    };
  }, []);

  // Wide Canvas mode: collapse / expand Column 3 programmatically
  useEffect(() => {
    const col3 = col3PanelRef.current;
    if (!col3) return;
    const currentlyCollapsed = col3.isCollapsed();
    if (wideCanvas && !currentlyCollapsed) {
      triggerMainSmoothResize();
      col3.collapse();
    } else if (!wideCanvas && currentlyCollapsed) {
      triggerMainSmoothResize();
      col3.expand();
    }
  }, [wideCanvas, col3PanelRef, triggerMainSmoothResize]);

  // Smart Auto-Flex for Middle Column (Zones 2, 3+4, 5)
  useEffect(() => {
    if (!hasMountedAutoFlexRef.current) {
      hasMountedAutoFlexRef.current = true;
      return;
    }

    const z2 = z2PanelRef.current;
    const z3 = z3PanelRef.current;
    const z5 = z5PanelRef.current;
    if (!z2 || !z3 || !z5) return;

    triggerMiddleSmoothResize();

    const frameId = window.requestAnimationFrame(() => {
      if (maximizedMiddleZone === "z2") {
        z2.resize("62%");
        z5.resize("16%");
        return;
      }
      if (maximizedMiddleZone === "z3") {
        z2.resize("16%");
        z5.resize("18%");
        return;
      }
      if (maximizedMiddleZone === "z5") {
        z2.resize("16%");
        z5.resize("62%");
        return;
      }

      if (
        canvasMode === "paint" ||
        canvasMode === "mask" ||
        canvasMode === "split"
      ) {
        z2.resize("20%");
        z5.resize("26%");
      } else {
        z2.resize("26%");
        z5.resize("38%");
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    canvasMode,
    maximizedMiddleZone,
    autoFlexSignal,
    z2PanelRef,
    z3PanelRef,
    z5PanelRef,
    triggerMiddleSmoothResize,
  ]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useStudioStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+L: Instant Privacy Cover Lock (highest priority)
      if (mod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        state.togglePrivacyLocked();
        return;
      }

      // Block workspace shortcuts while privacy cover is engaged
      if (state.privacyLocked) return;

      // Ctrl+K: Command Palette
      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        state.setCommandPaletteOpen(!state.commandPaletteOpen);
        return;
      }

      // Ctrl+Enter: Submit generation immediately
      if (mod && e.key === "Enter") {
        e.preventDefault();
        void state.submitGeneration();
        return;
      }

      // Escape: Dismiss topmost overlay / expanded stack
      if (e.key === "Escape") {
        if (state.commandPaletteOpen) {
          e.preventDefault();
          state.setCommandPaletteOpen(false);
          return;
        }
        if (state.fullViewportGalleryOpen) {
          e.preventDefault();
          state.setFullViewportGalleryOpen(false);
          return;
        }
        if (state.expandedIterationNodeId) {
          e.preventDefault();
          state.setExpandedIterationNodeId(null);
          return;
        }
      }

      // Space: Hold-to-peek parent comparison in Inspect mode
      if (
        e.code === "Space" &&
        !e.repeat &&
        !mod &&
        !e.altKey &&
        !e.shiftKey &&
        state.canvasMode === "inspect" &&
        !state.commandPaletteOpen &&
        !state.fullViewportGalleryOpen &&
        !isEditableElement(e.target)
      ) {
        e.preventDefault();
        state.setHoldingPeek(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const state = useStudioStore.getState();
        if (state.isHoldingPeek) {
          state.setHoldingPeek(false);
        }
      }
    };

    const handleWindowBlur = () => {
      const state = useStudioStore.getState();
      if (state.isHoldingPeek) {
        state.setHoldingPeek(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-obsidian-void p-2 text-zinc-100">
      {/* 3-Column Obsidian Pro Bento Shell */}
      <div
        className="h-full w-full"
        data-programmatic-resize={isMainProgrammaticResize ? "true" : "false"}
      >
        <Group
          id="ark-studio-bento-root"
          orientation="horizontal"
          className="h-full w-full gap-2"
        >
          {/* COLUMN 1: Main Image Window + Iterations Strip */}
          <Panel
            id="col-1-canvas"
            defaultSize="42%"
            minSize="28%"
            className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-hairline bg-bento-surface"
          >
            <MainImageWindow />
          </Panel>

          <Separator
            id="sep-col1-col2"
            className="my-2 w-[1px] rounded-full bg-hairline hover:bg-accent-violet"
          />

          {/* COLUMN 2: Dynamic Context-Morphing Middle Stack (Zones 2, 3+4, 5) */}
          <Panel
            id="col-2-middle"
            defaultSize="31%"
            minSize="24%"
            className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-hairline bg-bento-surface"
          >
            <div
              className="h-full w-full"
              data-programmatic-resize={
                isMiddleProgrammaticResize ? "true" : "false"
              }
            >
              <Group
                id="ark-studio-middle-stack"
                orientation="vertical"
                className="h-full w-full"
              >
                {/* Zone 2: References (Slots / Pinboard / Kits) */}
                <Panel
                  id="zone-2-references"
                  panelRef={z2PanelRef}
                  defaultSize="26%"
                  minSize="14%"
                  className="flex min-h-0 flex-col overflow-hidden bg-bento-surface"
                >
                  <ReferencesZone />
                </Panel>

                <Separator
                  id="sep-z2-z3"
                  className="h-[1px] w-full bg-hairline hover:bg-accent-violet"
                />

                {/* Zone 3 (Contextual Deck) + Static Ultra-Compact Zone 4 (Model Settings Strip) */}
                <Panel
                  id="zone-3-deck-and-settings"
                  panelRef={z3PanelRef}
                  defaultSize="36%"
                  minSize="18%"
                  className="flex min-h-0 flex-col overflow-hidden bg-bento-surface"
                >
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <ContextualDeckZone />
                  </div>
                  <div className="shrink-0 border-t border-hairline bg-bento-surface">
                    <ModelSettingsStrip />
                  </div>
                </Panel>

                <Separator
                  id="sep-z4-z5"
                  className="h-[1px] w-full bg-hairline hover:bg-accent-violet"
                />

                {/* Zone 5: Prompt Studio */}
                <Panel
                  id="zone-5-prompt"
                  panelRef={z5PanelRef}
                  defaultSize="38%"
                  minSize="16%"
                  className="flex min-h-0 flex-col overflow-hidden bg-bento-surface"
                >
                  <PromptStudioZone />
                </Panel>
              </Group>
            </div>
          </Panel>

          <Separator
            id="sep-col2-col3"
            className="my-2 w-[1px] rounded-full bg-hairline hover:bg-accent-violet"
          />

          {/* COLUMN 3: Mini-Gallery / Vault / Collections Explorer */}
          <Panel
            id="col-3-explorer"
            panelRef={col3PanelRef}
            defaultSize="27%"
            minSize="18%"
            collapsible
            collapsedSize="0%"
            onResize={(panelSize) => {
              const collapsedNow = panelSize.asPercentage === 0;
              if (collapsedNow !== wideCanvas) {
                setWideCanvas(collapsedNow);
              }
            }}
            className={
              wideCanvas
                ? "flex min-w-0 flex-col overflow-hidden"
                : "flex min-w-0 flex-col overflow-hidden rounded-xl border border-hairline bg-bento-surface"
            }
          >
            <MiniGalleryExplorer />
          </Panel>
        </Group>
      </div>

      {/* Global Overlays & Notifications */}
      <FullViewportGalleryModal />
      <CommandPalette />
      <PrivacyCover />

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#191D2A",
            border: "1px solid rgba(255, 255, 255, 0.07)",
            color: "#F3F4F6",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "12px",
          },
        }}
      />
    </div>
  );
}

export default App;
