# Customizable workspace

Ark's main studio uses GridStack 12.6.0 for panel geometry. It does not replace the existing Nocturne UI. Canvas, Studio Controls and Mini Library are still their original React components.

- Select **Layout** in the main header to edit the workspace. Drag a panel by its temporary handle and resize from any edge or corner. Drop it over another panel to reorder a packed row or column without changing widths or heights. A highlighted drop preview shows the result. Empty grid space is allowed; irregular layouts swap positions or rectangles when valid.
- Select **Done** to lock the layout. Handles and grid lines disappear so normal image operations cannot move a panel.
- With a panel's handle focused, use arrow keys to move or reorder adjacent panels, or Shift+arrow keys to resize into unoccupied cells.
- The Mini toggle still hides/shows the library. Two workspace configurations are saved independently (library open and closed).
- Reset (shown while editing) restores the current configuration. The default honors the previous Mini Library side preference.
- Layout geometry is stored locally in the browser under `ark-workspace-grid-v1:open` and `ark-workspace-grid-v1:closed`. Invalid stored layouts fall back to defaults. No generation settings or private image assets are stored by this feature.

The first version has a bounded 24-by-24 grid, minimum panel dimensions, collision handling, and local persistence. It does not add nested sub-grids, floating windows, named workspace presets or import/export. Those are possible future extensions.

Visual review includes the edit state, a custom layout, a reload persistence check and the existing normal studio captures.
