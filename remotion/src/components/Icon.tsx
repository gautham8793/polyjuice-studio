// Simple line icons for ideas that have no photo (stats tiles). Drawn in the theme color.
const PATHS: Record<string, React.ReactNode> = {
  // megaphone — backlash / protest
  megaphone: (
    <>
      <path d="M8 26v12h8l20 12V14L16 26H8z" />
      <path d="M16 38l4 14h6l-3-12" />
      <path d="M44 22c4 3 4 17 0 20M50 16c8 6 8 26 0 32" />
    </>
  ),
  // house with a closed door — supporters stay home
  home: (
    <>
      <path d="M8 30L32 10l24 20" />
      <path d="M14 26v28h36V26" />
      <path d="M27 54V40h10v14" />
    </>
  ),
  // balance scales — voters balance power
  scales: (
    <>
      <path d="M32 8v46M20 54h24M12 16h40" />
      <path d="M12 16L4 34h16L12 16zM52 16l-8 18h16l-8-18z" />
      <path d="M4 34c0 5 16 5 16 0M44 34c0 5 16 5 16 0" />
    </>
  ),
};

export const Icon: React.FC<{ name: string; size: number; color: string }> = ({ name, size, color }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
    {PATHS[name]}
  </svg>
);
