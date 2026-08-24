import type { FileRow } from "@/lib/ipc-types";

export function linkLabel(file: FileRow): string {
  return file.name ?? file.relPath.split("/").at(-1) ?? file.relPath;
}
