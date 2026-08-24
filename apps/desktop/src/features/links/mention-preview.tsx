import { SkillPreviewCard } from "./skill-preview";
import type { SkillMentions } from "./use-skill-mentions";

export function MentionPreview({ mentions }: { mentions: SkillMentions }) {
  if (!mentions.hovered) {
    return null;
  }

  return (
    <SkillPreviewCard
      anchor={mentions.hovered.anchor}
      file={mentions.hovered.file}
      onOpen={(file) => {
        mentions.close();
        mentions.openFile(file);
      }}
      onOpenChange={(next) => {
        if (!next) {
          mentions.close();
        }
      }}
      open
      popupProps={mentions.popupProps}
    />
  );
}
