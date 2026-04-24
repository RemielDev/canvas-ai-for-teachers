import type { BubblePill as PillSchema } from "@/shared/messages";

type Props = {
  pill: PillSchema;
  onTap: () => void;
};

export function BubblePill({ pill, onTap }: Props) {
  const cls = [
    "canvas-ai-bubble",
    pill.selected ? "canvas-ai-bubble-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      onClick={onTap}
      title={pill.hint}
      aria-pressed={pill.selected}
    >
      {pill.label}
      {pill.selected && <span aria-hidden> ✓</span>}
    </button>
  );
}
