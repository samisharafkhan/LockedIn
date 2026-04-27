type MascotBubbleProps = {
  emoji?: string;
  label?: string;
  size?: "sm" | "md";
};

export function MascotBubble({ emoji = "🐼", label = "LockedIn mascot", size = "md" }: MascotBubbleProps) {
  return (
    <div
      className={`mascot-bubble mascot-bubble--${size}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <span aria-hidden>{emoji}</span>
    </div>
  );
}
