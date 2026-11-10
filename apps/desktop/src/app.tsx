import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarIconRail,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarPanel,
  SidebarProvider,
  SidebarRail,
} from "@ctrl-ui/react/ui/sidebar";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PRIMARY_VIEWS, VIEW_IDS, type ViewId } from "./app-views";
import { CommandPalette } from "./features/command/command-palette";
import { DuplicatesView } from "./features/duplicates/duplicates-view";
import { EditorPane } from "./features/library/editor-pane";
import { LibraryPanel } from "./features/library/library-panel";
import { NewSkillDialog } from "./features/library/new-skill-dialog";
import { UnsavedChangesDialog } from "./features/library/unsaved-changes-dialog";
import { useLibraryFile } from "./features/library/use-library-file";
import { useLibraryIndex } from "./features/library/use-library-index";
import { useFavoriteProjects } from "./features/projects/use-favorite-projects";
import { PromptHistoryView } from "./features/prompts/prompt-history-view";
import { RegistryPane } from "./features/registry/registry-pane";
import { useScan } from "./features/scan/use-scan";
import { SettingsView } from "./features/settings/settings-view";
import { GroupsView } from "./features/sync/groups-view";
import { UpdateButton } from "./features/updates/update-button";
import { useAppUpdate } from "./features/updates/use-app-update";
import type { FileRow } from "./lib/ipc-types";
import { useAppReloadShortcut } from "./use-app-reload-shortcut";
import { useAppShortcuts } from "./use-app-shortcuts";

const ACTIVE_VIEW_STORAGE_KEY = "another-dev-tool.active-view";
const PANEL_STORAGE_KEY = "another-dev-tool.library-panel";

function readStoredView(): ViewId {
  const stored = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
  return VIEW_IDS.find((id) => id === stored) ?? "library";
}

export function App() {
  useAppReloadShortcut();
  const [view, setView] = useState<ViewId>(readStoredView);
  const [mountedViews, setMountedViews] = useState<ReadonlySet<ViewId>>(
    () => new Set([view])
  );
  const [panelOpen, setPanelOpen] = useState(
    () => window.localStorage.getItem(PANEL_STORAGE_KEY) !== "closed"
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const [awaitedFileId, setAwaitedFileId] = useState<number | null>(null);
  const index = useLibraryIndex();
  const library = useLibraryFile();
  const favoriteProjects = useFavoriteProjects();
  const scan = useScan();
  const update = useAppUpdate();

  const selectView = useCallback((next: ViewId) => {
    setMountedViews((current) =>
      current.has(next) ? current : new Set([...current, next])
    );
    setView(next);
    window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, next);
  }, []);

  const togglePanel = useCallback((open: boolean) => {
    setPanelOpen(open);
    window.localStorage.setItem(PANEL_STORAGE_KEY, open ? "open" : "closed");
  }, []);

  const selectFile = library.select;
  const openFile = useCallback(
    (file: FileRow) => {
      selectView("library");
      selectFile(file);
    },
    [selectFile, selectView]
  );

  // A file written a moment ago (new skill, registry install) is opened as soon
  // as the index reports it, rather than racing the index refresh.
  const awaitedFile =
    awaitedFileId === null
      ? undefined
      : index.files.find((file) => file.id === awaitedFileId);
  useEffect(() => {
    if (awaitedFile) {
      setAwaitedFileId(null);
      openFile(awaitedFile);
    }
  }, [awaitedFile, openFile]);

  const openNewSkill = useCallback(() => setNewSkillOpen(true), []);
  useAppShortcuts({
    onOpenPalette: () => setPaletteOpen(true),
    onNewSkill: openNewSkill,
    onSave: library.editor.save,
  });

  // Folders are picked up without asking: what is on disk is what the app shows.
  const startScan = scan.start;
  useEffect(() => {
    startScan();
  }, [startScan]);

  const selected =
    index.files.find((file) => file.id === library.fileId) ??
    (library.file?.id === library.fileId ? library.file : null);

  return (
    <SidebarProvider
      className="h-dvh"
      defaultWidth={332}
      layout="contained"
      maxWidth={560}
      minWidth={288}
      onOpenChange={togglePanel}
      open={panelOpen && view === "library"}
      persistOpen={false}
    >
      <Sidebar collapsible="icon" variant="inset">
        <SidebarIconRail>
          <SidebarHeader>
            <div
              className="h-(--sidebar-strip-height)"
              data-tauri-drag-region
            />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu aria-label="Views">
                {PRIMARY_VIEWS.map(({ id, label, icon: Icon }) => {
                  const unsaved = id === "library" && library.editor.dirty;
                  return (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        aria-label={
                          unsaved ? `${label}, unsaved changes` : label
                        }
                        isActive={view === id}
                        onClick={() => {
                          if (id === "library" && view === "library") {
                            togglePanel(!panelOpen);
                          }
                          selectView(id);
                        }}
                        tooltip={label}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      {unsaved ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute end-1 top-1 size-1.5 rounded-full bg-warning"
                        />
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu aria-label="App">
              <UpdateButton
                unsavedFile={library.editor.dirty ? selected : null}
                update={update}
              />
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={view === "settings"}
                  onClick={() => selectView("settings")}
                  tooltip="Settings"
                >
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </SidebarIconRail>
        <SidebarPanel layer="sidebar">
          <LibraryPanel
            favoritePaths={favoriteProjects.favoritePaths}
            index={index}
            onNewSkill={openNewSkill}
            onOpenSettings={() => selectView("settings")}
            onSelectFile={library.select}
            scan={scan}
            selectedFileId={library.fileId}
          />
        </SidebarPanel>
        <SidebarRail />
      </Sidebar>

      <SidebarInset render={<main />}>
        <div className="h-full min-h-0" hidden={view !== "library"}>
          <EditorPane
            editor={library.editor}
            favorite={
              selected?.projectDir
                ? favoriteProjects.favoritePaths.has(selected.projectDir)
                : false
            }
            file={selected}
            hasFiles={index.files.length > 0}
            onClose={library.close}
            onNewSkill={openNewSkill}
            onOpenFile={library.select}
            onToggleFavorite={favoriteProjects.toggle}
          />
        </div>
        {mountedViews.has("prompts") ? (
          <div className="h-full min-h-0" hidden={view !== "prompts"}>
            <PromptHistoryView />
          </div>
        ) : null}
        {mountedViews.has("duplicates") ? (
          <div className="h-full min-h-0" hidden={view !== "duplicates"}>
            <DuplicatesView
              onGroupCreated={() => selectView("sync")}
              onOpenFile={openFile}
            />
          </div>
        ) : null}
        {mountedViews.has("sync") ? (
          <div className="h-full min-h-0" hidden={view !== "sync"}>
            <GroupsView onOpenFile={openFile} />
          </div>
        ) : null}
        {mountedViews.has("registry") ? (
          <div className="h-full min-h-0" hidden={view !== "registry"}>
            <RegistryPane index={index} onInstalled={setAwaitedFileId} />
          </div>
        ) : null}
        {mountedViews.has("settings") ? (
          <div className="h-full min-h-0" hidden={view !== "settings"}>
            <SettingsView
              onFoldersChanged={index.refresh}
              scan={scan}
              update={update}
            />
          </div>
        ) : null}
      </SidebarInset>

      <CommandPalette
        files={index.files}
        onNewSkill={openNewSkill}
        onOpenChange={setPaletteOpen}
        onOpenFile={openFile}
        onRescan={startScan}
        onSelectView={selectView}
        open={paletteOpen}
      />
      <NewSkillDialog
        files={index.files}
        onCreated={setAwaitedFileId}
        onOpenChange={setNewSkillOpen}
        open={newSkillOpen}
        roots={index.roots}
        selectedFile={selected}
      />
      <UnsavedChangesDialog library={library} />
    </SidebarProvider>
  );
}
