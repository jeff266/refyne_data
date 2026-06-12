export function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="4" y="8" width="10" height="8"/>
      <path d="M6 8V6a3 3 0 0 1 6 0v2"/>
    </svg>
  );
}
