import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { FileText, Link2 } from "lucide-react";
import { useMemo } from "react";

import type { FileRow, Root } from "@/lib/ipc-types";
import {
  buildTree,
  expandedFolderIds,
  fileNodeId,
  TREE_ROOT_ID,
  type TreeNode,
} from "@/lib/tree";
import { TreeView } from "@/shared/components/ui/tree";

export interface FileTreeProps {
  files: FileRow[];
  roots: Root[];
  selectedFileId: number | null;
  onSelectFile: (file: FileRow) => void;
}

export function FileTree({
  files,
  roots,
  selectedFileId,
  onSelectFile,
}: FileTreeProps) {
  const index = useMemo(() => buildTree(files, roots), [files, roots]);
  const expanded = useMemo(() => expandedFolderIds(index), [index]);

  if (files.length === 0) {
    return (
      <p className="px-4 py-6 text-muted-foreground text-sm">
        Nothing indexed yet — add a root and run a scan.
      </p>
    );
  }

  return (
    <TreeView<TreeNode>
      expandedIds={expanded}
      getChildren={(node) => node.childIds}
      getName={(node) => node.name}
      isFolder={(node) => node.isFolder}
      items={index}
      label="Indexed agent files"
      onSelect={(_, node) => {
        if (node.file) {
          onSelectFile(node.file);
        }
      }}
      renderLabel={(node) => <TreeLabel node={node} />}
      rootItemId={TREE_ROOT_ID}
      selectedId={selectedFileId === null ? null : fileNodeId(selectedFileId)}
    />
  );
}

function TreeLabel({ node }: { node: TreeNode }) {
  if (node.isFolder) {
    return <span className="truncate">{node.name}</span>;
  }

  const file = node.file;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
      {file?.isSymlink ? (
        <Link2 className="size-3 shrink-0 text-chart-3" />
      ) : null}
      {file ? (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {targetLabel(file.kind)}
        </span>
      ) : null}
    </span>
  );
}
