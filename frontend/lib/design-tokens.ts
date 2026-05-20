/**
 * Refyne Design System Tokens
 *
 * Color palette and typography tokens for the Refyne UI.
 */

// Color tokens
export const C = {
  bg:        '#09090B',
  sidebar:   '#0E0E12',
  surface:   '#18181B',
  hover:     '#1F1F23',
  border:    'rgba(255,255,255,0.06)',
  border2:   'rgba(255,255,255,0.1)',
  text:      '#FAFAFA',
  text2:     '#A1A1AA',
  text3:     '#52525B',
  indigo:    '#6366F1',
  indigoLt:  '#818CF8',
  indigoDk:  '#4338CA',
  indigoDim: 'rgba(99,102,241,0.1)',
  indigoBrd: 'rgba(99,102,241,0.25)',
  green:     '#22C55E',
  greenDim:  'rgba(34,197,94,0.08)',
  greenBrd:  'rgba(34,197,94,0.2)',
  greenLt:   '#86EFAC',
  red:       '#EF4444',
  redDim:    'rgba(239,68,68,0.08)',
  redBrd:    'rgba(239,68,68,0.2)',
  redLt:     '#FCA5A5',
  amber:     '#F59E0B',
  amberDim:  'rgba(245,158,11,0.08)',
  amberBrd:  'rgba(245,158,11,0.2)',
  yellow:    '#EAB308',
} as const;

// Font tokens
export const F = {
  sans: "'Plus Jakarta Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

// Navigation configuration
export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { divider: true },
  { group: 'Data' },
  { id: 'enrich',      label: 'Enrich',        icon: 'Search' },
  { id: 'normalize',   label: 'Normalize',     icon: 'ArrowUpDown' },
  { id: 'dedup',       label: 'Dedup',         icon: 'GitMerge' },
  { id: 'quarantine',  label: 'Quarantine',    icon: 'Shield' },
  { id: 'arrangements', label: 'Arrangements',  icon: 'Workflow' },
  { divider: true },
  { group: 'Config' },
  { id: 'harmonies',   label: 'Harmonies',     icon: 'Sparkles' },
  { id: 'mappings',    label: 'Field Mappings', icon: 'ArrowRightLeft' },
  { id: 'connections', label: 'Connections',   icon: 'Plug2' },
] as const;

// Page metadata
export const PAGE_META: Record<string, { label: string; action: string | null }> = {
  dashboard:    { label: 'Dashboard',      action: null },
  enrich:       { label: 'Enrich',         action: 'New search' },
  normalize:    { label: 'Normalize',      action: null },
  dedup:        { label: 'Dedup',          action: 'Run scan' },
  quarantine:   { label: 'Quarantine',     action: null },
  arrangements: { label: 'Arrangements',   action: 'New arrangement' },
  harmonies:    { label: 'Harmonies',      action: null },
  mappings:     { label: 'Field Mappings', action: null },
  connections:  { label: 'Connections',    action: 'Add connection' },
};

export type NavItem =
  | { id: string; label: string; icon: string; divider?: never; group?: never }
  | { divider: true; id?: never; label?: never; icon?: never; group?: never }
  | { group: string; id?: never; label?: never; icon?: never; divider?: never };

export type ChipColor = 'indigo' | 'green' | 'red' | 'amber';
