import { Combobox } from "@base-ui/react/combobox";
import { Check, Folder, Star } from "lucide-react";
import type { ReactNode } from "react";

import type { DestinationFolder } from "@/lib/ipc-types";
import { destinationParts } from "./destination-path";

export const ROW_CLASS =
  "flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none select-none data-disabled:cursor-not-allowed data-highlighted:bg-accent data-highlighted:text-accent-foreground";

export function PickerRow({
  icon,
  label,
  onClick,
  value,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <Combobox.Item className={ROW_CLASS} onClick={onClick} value={value}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Combobox.Item>
  );
}

export function FolderRow({
  folder,
  home,
  onSelect,
  onToggleFavorite,
  selected,
}: {
  folder: DestinationFolder;
  home: string | null;
  onSelect: (path: string) => void;
  onToggleFavorite: (path: string) => Promise<void>;
  selected: boolean;
}) {
  const { name, parent } = destinationParts(folder.path, home);
  return (
    <Combobox.Item
      className={`group/row ${ROW_CLASS}`}
      disabled={!folder.available}
      onClick={() => onSelect(folder.path)}
      title={folder.path}
      value={folder.path}
    >
      <Folder className="size-4 shrink-0 text-muted-foreground" />
      <span className="max-w-[14rem] truncate font-medium">{name}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
        {parent}
      </span>
      {folder.available ? null : (
        <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive text-xs">
          Missing
        </span>
      )}
      {folder.available && folder.fileCount > 0 ? (
        <span className="shrink-0 text-muted-foreground text-xs">
          {folder.fileCount}
        </span>
      ) : null}
      <FavoriteButton
        folder={folder}
        name={name}
        onToggle={onToggleFavorite}
        visible={selected}
      />
      <Check className={`size-4 shrink-0 ${selected ? "" : "invisible"}`} />
    </Combobox.Item>
  );
}

/** Kept quiet on a long list, but always offered on the folder in hand — starring
 * what you just picked is the whole point of the list. */
function FavoriteButton({
  folder,
  name,
  onToggle,
  visible,
}: {
  folder: DestinationFolder;
  name: string;
  onToggle: (path: string) => Promise<void>;
  visible: boolean;
}) {
  const resting = folder.favorite || visible ? "opacity-100" : "opacity-0";
  return (
    <button
      aria-label={
        folder.favorite
          ? `Remove ${name} from favorites`
          : `Add ${name} to favorites`
      }
      className={`flex size-6 shrink-0 items-center justify-center rounded-md transition-opacity hover:bg-background/60 hover:text-foreground group-hover/row:opacity-100 group-data-highlighted/row:opacity-100 ${resting} ${
        folder.favorite ? "text-foreground" : "text-muted-foreground"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(folder.path);
      }}
      tabIndex={-1}
      type="button"
    >
      <Star className={`size-3.5 ${folder.favorite ? "fill-current" : ""}`} />
    </button>
  );
}
