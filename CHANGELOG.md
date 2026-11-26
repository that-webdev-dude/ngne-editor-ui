# Changelog

All notable changes to `@ngne/editor-ui`. The package follows semantic versions; in 0.x a
minor version may break the API and a patch never does (docs/SPEC.md §13). Each release has a
section here, written when it is released.

## 0.1.0 (2026-11-26)

The first release: the shared interface of the NGNE editor suite, moved from the NGNE Sprite
Editor and the NGNE Tilemap Editor so that every editor of the suite looks and behaves the same.

- One editor UI instance per app from `createEditorUi`: its menus, commands, keys, dialogs,
  dock panels, context bars, tools, overlays and status fields come from the app's modules,
  and the persisted names (storage keys, cache names) derive from the app's id
  (docs/SPEC.md §5).
- The suite's design tokens and stylesheet, primitives on Radix, focus handling, toasts and
  dialogs, the application shell (menu bar, tool rail, context bar, dock, tab strip, status
  bar, bottom region), the command palette and shortcut sheet, the PWA update flow and service
  worker, the About and Open Source Licences dialogs with their build helpers, and colour
  maths.
- The design canon (docs/DESIGN.md) and a gallery that shows every token and component in both
  themes, which an editor can mount with entries of its own.
- Peers, pinned exactly: `react` and `react-dom` 19.3.0, `radix-ui` 1.7.0, `lucide-react`
  1.55.0, `zustand` 5.0.15. No runtime dependencies.

### API

Each subpath of `exports` and every name it exports, types included (docs/SPEC.md §4–§12).

- `@ngne/editor-ui`: `AnyEditorUi`, `AppInfo`, `BottomRegion`, `CommandRefreshSource`, `DEFAULT_THEME`, `EditorUi`, `EditorUiConfig`, `EditorUiKeyContexts`, `EditorUiModules`, `EditorUiSources`, `PersistedNames`, `RecentCommandsState`, `ResolvedEditorUiConfig`, `SurfaceState`, `Surfaces`, `Theme`, `ThemeState`, `UiRoot`, `UiRootProps`, `createEditorUi`, `createRecentCommandsStore`, `createThemeStore`, `persistedNames`, `setTheme`, `useEditorUi`, `useTheme`.
- `@ngne/editor-ui/styles.css` (stylesheet, no names).
- `@ngne/editor-ui/styles/check`: `checkStylesheets`.
- `@ngne/editor-ui/primitives`: `Button`, `ButtonProps`, `ClosingPopover`, `ContextMenu`, `ContextMenuEntry`, `ContextMenuProps`, `Dialog`, `DialogProps`, `ICON_SIZE`, `ICON_STROKE`, `Icon`, `IconButton`, `IconButtonProps`, `NumberField`, `NumberFieldProps`, `Popover`, `PopoverProps`, `SegmentedControl`, `SegmentedControlProps`, `SegmentedOption`, `Select`, `SelectOption`, `SelectProps`, `Slider`, `SliderProps`, `Splitter`, `SplitterProps`, `TOOLTIP_DELAY_MS`, `Toggle`, `ToggleProps`, `ToolButton`, `ToolButtonProps`, `Tooltip`, `TooltipProps`, `TooltipProvider`, `cx`, `useClosingPopover`.
- `@ngne/editor-ui/focus`: `ControlElement`, `KEEP_FOCUS_ATTRIBUTE`, `Modality`, `ModalityKey`, `focusMenuOpener`, `focusReturningControl`, `focusReturningSelect`, `inertOutsideModalLayers`, `isKeyboardNavigation`, `panelSelector`, `returnFocusToViewport`, `surfaceOpener`, `trackFocusModality`, `trackMenuOrigins`.
- `@ngne/editor-ui/messages`: `CommandDialog`, `CommandDialogModule`, `CommandDialogs`, `DialogComponent`, `DialogHost`, `DialogHostProps`, `DialogRequestBase`, `DialogRequests`, `DialogState`, `DialogView`, `DiscardAction`, `DiscardChangesDialog`, `DiscardChangesRequest`, `INFO_TOAST_MS`, `NoticeKind`, `NoticeOptions`, `NoticeSink`, `Notices`, `RegionBoundary`, `RegionBoundaryProps`, `ToastAction`, `ToastItem`, `ToastKind`, `ToastOptions`, `ToastService`, `ToastState`, `ToastViewport`, `WebGpuRequired`, `WebGpuRequiredProps`, `WindowTooSmall`, `WindowTooSmallProps`, `commandDialog`, `commandDialogs`, `createDialogRequests`, `createNotices`, `createToastService`, `dialogView`, `notices`, `toast`, `useDialogRequest`.
- `@ngne/editor-ui/shell`: `AppShell`, `AppShellProps`, `BOTTOM_HEIGHT`, `BottomRegionState`, `BottomRegionTarget`, `ChoiceToolOption`, `ContextBarContent`, `ContextBarContentModule`, `DOCK_WIDTH`, `DockPanel`, `DockPanelModule`, `LayoutSizes`, `LayoutState`, `MIN_WINDOW_HEIGHT`, `MIN_WINDOW_WIDTH`, `NEXT_REGION_COMMAND`, `NumberToolOption`, `PREVIOUS_REGION_COMMAND`, `PlannedToolSpec`, `RAIL`, `REGION_ATTRIBUTE`, `REGION_FOCUS_ATTRIBUTE`, `RailFilter`, `RailSlot`, `RegisteredTool`, `RegistrationError`, `SHELL_REGIONS`, `ShellRegion`, `StatusBarSource`, `StatusField`, `StatusFieldModule`, `StatusHint`, `TabStrip`, `TabStripItem`, `TabStripLeading`, `TabStripProps`, `ToggleToolOption`, `ToolAction`, `ToolBase`, `ToolHoldKey`, `ToolIcon`, `ToolModule`, `ToolOptionControl`, `ToolOptionSpec`, `ToolOptionValue`, `ToolRegistry`, `ToolStateSource`, `bottomMaxHeight`, `bottomRegionCommand`, `collapsedByDefault`, `collectContextBarContent`, `collectDockPanels`, `collectStatusFields`, `createBottomRegionStore`, `createLayoutStore`, `createToolRegistry`, `cycleFocusRegion`, `defaultBottomHeight`, `isWindowTooSmall`, `optionControl`, `optionValue`, `optionValues`, `parseStoredLayout`, `railColumns`, `railGroups`, `railOneColumnHeight`, `regionFocusTarget`, `registerToolModules`, `resolveBottomHeight`, `resolveDockWidth`, `setBottomRegionVisible`, `slotOf`, `storedLayout`, `useToolState`, `useWindowTooSmall`.
- `@ngne/editor-ui/commands`: `BASE_CONTEXTS`, `BaseContext`, `COMMAND_PALETTE_COMMAND`, `Chord`, `ChordConflict`, `ChordError`, `ChordModifiers`, `ChordParts`, `ChordProps`, `Command`, `CommandErrorHandler`, `CommandModule`, `CommandPalette`, `CommandPaletteTrigger`, `CommandRegistry`, `CommandRegistryOptions`, `CommandRunner`, `CommandSpec`, `ContextMenuPlacement`, `DEFAULT_MENU_ORDER`, `FocusedElement`, `KeyContext`, `KeyContextLists`, `KeyContextState`, `KeyContextTarget`, `KeyEnvironment`, `KeyEventLike`, `KeyResolution`, `KeymapDocument`, `KeymapEvent`, `KeymapOptions`, `KeymapTarget`, `MAX_RECENT_COMMANDS`, `MenuBarEntry`, `MenuNode`, `MenuPath`, `NATIVE_KEYS`, `OTHER_SHORTCUTS`, `OVERLAY_ATTRIBUTE`, `OVERLAY_SELECTOR`, `PaletteEntry`, `PlannedCommandSpec`, `RecentCommandsRecorder`, `RecentCommandsStorage`, `RegistrationError`, `SHORTCUT_SHEET_COMMAND`, `ShortcutGroup`, `ShortcutRow`, `ShortcutSheet`, `SurfaceHost`, `VIEWPORT_FOCUS_ATTRIBUTE`, `activeKeyContexts`, `applicableContexts`, `buildContextMenu`, `buildMenu`, `buildMenuBar`, `chordFromEvent`, `chordKey`, `chordModifiers`, `contextMenuEntries`, `createCommandRegistry`, `createCommandRunner`, `createKeyContextStore`, `eventKey`, `findChordConflicts`, `formatChord`, `fuzzyScore`, `installKeymap`, `invokeCommand`, `isBrowserChord`, `isCharacterChord`, `isNativeKeyChord`, `isTextEditingChord`, `isTextField`, `keyContextOrder`, `menuBarProblems`, `menuCommands`, `nativeKeysOf`, `normalizeChord`, `paletteEntries`, `paletteScore`, `parseChord`, `parseRecentCommands`, `readKeyEnvironment`, `readRecentCommands`, `registerCommandModules`, `reportCommandError`, `resolveKey`, `runCommand`, `runPaletteCommand`, `setKeyContext`, `shortcutGroups`, `useCommandValue`, `useCommands`, `withRecentCommand`, `writeRecentCommands`.
- `@ngne/editor-ui/overlay`: `OverlayLayer`, `OverlayLayerModule`, `RegistrationError`, `WHEEL_ZOOM_TRAVEL`, `collectOverlayLayers`, `createWheelPan`, `createWheelZoom`, `wheelPixels`.
- `@ngne/editor-ui/platform`: `ADAPTER_ATTEMPTS`, `ADAPTER_TIMED_OUT`, `ADAPTER_TIMEOUT_MS`, `KeyValueStorage`, `NavigatorLike`, `STORAGE_WRITE_FAILED_MESSAGE`, `StorageFailures`, `WebGpuCheckLimits`, `WebGpuSupport`, `browserStorage`, `checkWebGpu`, `createStorageFailures`, `detectWebGpu`, `initialWebGpuSupport`, `readItem`, `readJson`, `storageFailures`, `useWebGpuSupport`, `useWindowHeight`, `useWindowWidth`, `writeItem`.
- `@ngne/editor-ui/pwa`: `AppUpdateOptions`, `AppUpdates`, `ContainerLike`, `PrecacheEntry`, `PwaNames`, `RELOAD_KEPT_MS`, `RegistrationLike`, `RequestLike`, `ResponseLike`, `Route`, `UPDATE_CHECK_MS`, `UPDATE_MESSAGE`, `UpdateState`, `WorkerLike`, `cacheName`, `cacheable`, `isOwnCache`, `mayDeleteStale`, `olderFile`, `precacheUrls`, `pwaNames`, `registerAppUpdates`, `route`, `searchOrder`, `showUpdateToast`, `staleCaches`, `uniqueEntries`.
- `@ngne/editor-ui/pwa/worker`: `PrecacheEntry`, `ServiceWorkerOptions`, `installServiceWorker`.
- `@ngne/editor-ui/about`: `ABOUT_COMMAND`, `AboutDialog`, `AppInfo`.
- `@ngne/editor-ui/about/build`: `appInfoDefines`.
- `@ngne/editor-ui/licences`: `LICENCES_COMMAND`, `LICENCES_PATH`, `LicencesDialog`, `LicencesRequest`.
- `@ngne/editor-ui/licences/build`: `ALLOWED_LICENCES`, `BundleContext`, `BundleOutput`, `DevServer`, `ExcludedCode`, `LICENCES_FILE`, `LICENCE_PHRASES`, `LicenceError`, `LicenceText`, `LicencesInput`, `LicencesMismatch`, `LicencesOptions`, `LicencesPlugin`, `LicencesPlugins`, `LicencesServiceWorkerPlugin`, `LicencesWorkerPlugin`, `ModuleSource`, `PACKAGE_STAND_IN_TEXTS`, `PackageLicence`, `StandInTexts`, `VIRTUAL_MODULES`, `WriteOptions`, `buildLicencesFile`, `buildPackageDirs`, `bundlerPackagesOf`, `excludedCodeIn`, `fallbackFileOf`, `generateLicences`, `licenceAllowed`, `licenceTextMatches`, `licencesFileMismatch`, `licencesText`, `listedPackages`, `moduleSource`, `packageDirOf`, `packageDirsOf`, `readPackageLicence`, `runtimePackageDirs`, `strayPackages`, `unknownModules`, `unlistedPackages`.
- `@ngne/editor-ui/colour`: `BLACK`, `Hsv`, `LabelColour`, `Oklab`, `Rgb`, `Rgba`, `WHITE`, `contrastRatio`, `formatHex`, `formatHexColour`, `hsvToRgb`, `labelColourOn`, `oklabToSrgb8`, `packRgba`, `parseHex`, `parseHexColour`, `relativeLuminance`, `rgbToHsv`, `srgb8ToOklab`, `unpackRgba`, `writeOklab`.
- `@ngne/editor-ui/gallery`: `Gallery`, `GalleryEntry`, `GalleryProps`, `GalleryTheme`, `useGalleryTheme`.
- `@ngne/editor-ui/gallery.css` (stylesheet, no names).

### Gallery entries

The package's entries, in the gallery's order: `tokens`; primitives `button`, `icon-button`,
`tool-button`, `toggle`, `segmented`, `number-field`, `slider`, `select`, `popover`,
`closing-popover`, `dialog`, `context-menu`, `tooltip`, `splitter`, `icon`; messages `toast`,
`dialog-host`, `discard-changes`, `webgpu-required`, `window-too-small`, `region-boundary`;
commands `command-refresh`, `command-palette`, `shortcut-sheet`; `about`, `licences`; shell
`tab-strip`, `app-shell`, `context-bar`. The deployed site adds its demo editor
(`demo-editor`).
