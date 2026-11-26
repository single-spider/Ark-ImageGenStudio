# Studio Next: implementation and review loop

Approved scope: dynamic reference attachments; remove Utility shelf and prompt chips; Prompt history and reserved Wild Studio; upright vertical canvas tools; global floating dock with independent panel toggles; Slate theme. Preserve existing Nocturne craftsmanship and GridStack interaction. No unrelated visual flattening.

Each pass: implement one scope, commit to feat/studio-next, run Ark visual review on the branch (production build + Playwright), retrieve PNGs and report, inspect layout and interaction behavior, correct issues and repeat. The CI job automatically runs after every qualifying commit. Human/assistant visual assessment is distinct from automated checks; CI does not autonomously edit code. Main remains unchanged until validated.

Pass 1: attachments and prompt controls/history. Keep backend ref_roles for compatibility, with neutral Reference role. History records submitted prompts in local browser storage and reconstructs older entries from available assets. Future Wild Studio remains explicitly reserved. Clipboard read depends on browser permissions; Ctrl+V and file import remain fallback.

Next: vertical canvas tools, dock and visibility layout migration, Slate palette. Tests must cover left/right panel locations, all visibility combinations, resizing and persistence, clipboard/import, model limits, popup placement, and 1920x1080, 1440x900, 1280x720. Avoid using private assets or paid generation in CI.

Pass 2: native vertical canvas toolbar, actual React Bits Dock (upstream license retained), independent Studio Controls visibility, and Slate default theme. Existing Forest/Nocturne colors retained as a legacy option. The dock contains only the two agreed panel toggles. Visual review captures the new theme and visibility states.

Review pass 3: inspected all initial default-size renders; compact panels hid prompt history and ratio controls, and canvas toolbar glass was too light over bright images. Added container-height responsive sizing, stable three-column attachment layout, denser toolbar glass and visibility assertions for key controls. Added mock file import and clipboard-paste event regression tests; generation now rejects excess active references rather than silently dropping inputs.

Review pass 4: pass 3 completed the larger layouts, file import, clipboard-event fallback and history popup checks; the 1280×720 default failed the stricter ratio visibility assertion. Actual screenshot showed the bottom edge of the quick-ratio row abutting the pinned generation area. Reduced compact-only vertical spacing by roughly 20 px and added numerical diagnostics to the assertion. No changes to full-size layouts or panel functionality.
