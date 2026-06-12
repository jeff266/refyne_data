export function DragHandle({
  size = 18,
  color = 'currentColor'
}: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill={color}
    >
      <circle cx="6" cy="5" r="1.5"/>
      <circle cx="12" cy="5" r="1.5"/>
      <circle cx="6" cy="9" r="1.5"/>
      <circle cx="12" cy="9" r="1.5"/>
      <circle cx="6" cy="13" r="1.5"/>
      <circle cx="12" cy="13" r="1.5"/>
    </svg>
  );
}
