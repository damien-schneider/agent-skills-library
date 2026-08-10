import {
  hotkeysCoreFeature,
  type ItemInstance,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Virtualizer } from "virtua";

import { cn } from "@/lib/utils";

const INDENT_PX = 14;

export interface TreeViewProps<T> {
  rootItemId: string;
  items: Record<string, T>;
  getName: (item: T) => string;
  getChildren: (item: T) => string[];
  isFolder: (item: T) => boolean;
  renderLabel: (item: T, itemId: string) => ReactNode;
  selectedId?: string | null;
  onSelect?: (itemId: string, item: T) => void;
  expandedIds?: string[];
  label: string;
  className?: string;
}

export function TreeView<T>({
  rootItemId,
  items,
  getName,
  getChildren,
  isFolder,
  renderLabel,
  selectedId,
  onSelect,
  expandedIds,
  label,
  className,
}: TreeViewProps<T>) {
  const dataLoader = useMemo(
    () => ({
      getItem: (itemId: string) => items[itemId] as T,
      getChildren: (itemId: string) => {
        const item = items[itemId];
        return item ? getChildren(item) : [];
      },
    }),
    [items, getChildren]
  );

  const tree = useTree<T>({
    rootItemId,
    dataLoader,
    initialState: expandedIds ? { expandedItems: expandedIds } : undefined,
    getItemName: (item) => {
      const data = item.getItemData();
      return data ? getName(data) : "";
    },
    isItemFolder: (item) => {
      const data = item.getItemData();
      return data ? isFolder(data) : false;
    },
    onPrimaryAction: (item) => {
      const data = item.getItemData();
      if (data) {
        onSelect?.(item.getId(), data);
      }
    },
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
  });

  const visible = tree.getItems();

  return (
    <div
      {...tree.getContainerProps(label)}
      className={cn("h-full overflow-auto outline-none", className)}
    >
      <Virtualizer data={visible}>
        {(item) => (
          <TreeRow
            item={item}
            key={item.getKey()}
            renderLabel={renderLabel}
            selectedId={selectedId}
          />
        )}
      </Virtualizer>
    </div>
  );
}

function TreeRow<T>({
  item,
  renderLabel,
  selectedId,
}: {
  item: ItemInstance<T>;
  renderLabel: (item: T, itemId: string) => ReactNode;
  selectedId?: string | null;
}) {
  const data = item.getItemData();
  const itemProps = item.getProps();
  const isSelected = selectedId === item.getId();

  return (
    <button
      {...itemProps}
      className={cn(
        "flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-sm outline-none transition-colors",
        isSelected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 focus-visible:bg-accent/50"
      )}
      style={{ paddingLeft: item.getItemMeta().level * INDENT_PX + 6 }}
      type="button"
    >
      {item.isFolder() ? (
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            item.isExpanded() && "rotate-90"
          )}
        />
      ) : (
        <span className="size-3.5 shrink-0" />
      )}
      {data ? renderLabel(data, item.getId()) : null}
    </button>
  );
}
