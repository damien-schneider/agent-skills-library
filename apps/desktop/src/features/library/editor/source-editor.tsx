/**
 * The whole file as text, frontmatter included. It fills its pane and scrolls
 * on its own, so long files keep the header in place.
 */
export function SourceEditor({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <textarea
      aria-label={label}
      autoCapitalize="off"
      autoCorrect="off"
      className="block h-full w-full resize-none bg-transparent px-10 py-8 font-mono text-body leading-relaxed outline-none"
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      value={value}
    />
  );
}
