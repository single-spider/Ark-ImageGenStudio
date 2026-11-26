# Studio Next: implementation and review loop

Approved scope: dynamic reference attachments; remove Utility shelf and prompt chips; Prompt history and reserved Wild Studio; upright vertical canvas tools; global floating dock with independent panel toggles; Slate theme. Preserve existing Nocturne craftsmanship and GridStack interaction. No unrelated visual flattening.

Each pass: implement one scope, commit to feat/studio-next, run Ark visual review on the branch (production build + Playwright), retrieve PNGs and report, inspect layout and interaction behavior, correct issues and repeat. The CI job automatically runs after every qualifying commit. Human/assistant visual assessment is distinct from automated checks; CI does not autonomously edit code. Main remains unchanged until validated.

Pass 1: attachments and prompt controls/history. Keep backend ref_roles for compatibility, with neutral Reference role. History records submitted prompts in local browser storage and reconstructs older entries from available assets. Future Wild Studio remains explicitly reserved. Clipboard read depends on browser permissions; Ctrl+V and file import remain fallback.

Next: vertical canvas tools, dock and visibility layout migration, Slate palette. Tests must cover left/right panel locations, all visibility combinations, resizing and persistence, clipboard/import, model limits, popup placement, and 1920x1080, 1440x900, 1280x720. Avoid using private assets or paid generation in CI.
