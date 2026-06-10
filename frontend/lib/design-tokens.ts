/**
 * Refyne Design System Tokens
 *
 * Dark theme with improved contrast and typography.
 */

// Color tokens - Dark blue theme
export const C = {
  // Backgrounds
  bg:        '#0F1E30',  // Page background (slightly darker)
  sidebar:   '#0A1829',  // Sidebar background
  surface:   '#162944',  // Card/surface background
  hover:     '#1D3455',  // Hover state
  input:     '#1A3050',  // Input background (lighter than card)

  // Borders
  border:    'rgba(255,255,255,0.06)',  // Base border
  border2:   'rgba(249,248,245,0.15)',  // Input border
  borderFocus: '#2E6BA8',  // Input focus border

  // Text hierarchy
  text:      '#F9F8F5',  // Primary text (headings, labels)
  text2:     'rgba(249,248,245,0.7)',   // Secondary text (body, descriptions)
  text3:     'rgba(249,248,245,0.4)',   // Tertiary text (captions, placeholders)

  // Accent colors
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
  steel:     '#64748B',
  blue:      '#3B82F6',
  blueDim:   'rgba(59,130,246,0.08)',
  blueBrd:   'rgba(59,130,246,0.2)',
} as const;

// Font tokens
export const F = {
  serif: "'Lora', serif",
  sans:  "'Jost', sans-serif",
  mono:  "'JetBrains Mono', 'Fira Code', monospace",
} as const;

// Typography scale
export const T = {
  pageHeading: {
    fontFamily: F.serif,
    fontSize: '28px',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  sectionHeading: {
    fontFamily: F.serif,
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  tabLabel: {
    fontFamily: F.sans,
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: 1.5,
  },
  body: {
    fontFamily: F.sans,
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  caption: {
    fontFamily: F.sans,
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: 1.4,
    opacity: 0.6,
  },
  emptyState: {
    fontFamily: F.sans,
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.5,
    opacity: 0.5,
  },
} as const;

// Navigation configuration
export const NAV = [
  { group: 'OVERVIEW' },
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { divider: true },
  { group: 'CLEAN' },
  { id: 'normalize',   label: 'Normalize',     icon: 'ArrowUpDown' },
  { id: 'dedup',       label: 'Dedup',         icon: 'GitMerge' },
  { id: 'import',      label: 'Import',        icon: 'Upload', betaGated: true },
  { divider: true },
  { group: 'ENRICH' },
  { id: 'enrich',      label: 'Enrich',        icon: 'Search' },
  // Hidden: Prospect is a future product. Quarantine is undefined scope.
  // { id: 'prospect',    label: 'Prospect',      icon: 'Users' },
  // { id: 'quarantine',  label: 'Quarantine',    icon: 'Shield' },
  { divider: true },
  { group: 'CONFIGURE' },
  { id: 'harmonies',   label: 'Harmonies',     icon: 'Sparkles' },
  { id: 'connections', label: 'Connections',   icon: 'Plug2' },
  // Field Mappings removed June 2026 - dormant, replaced by harmony field assignments
  // { id: 'mappings',    label: 'Field Mappings', icon: 'ArrowRightLeft' },
  { divider: true },
  { group: 'ACCOUNT' },
  { id: 'history',     label: 'History',       icon: 'Clock' },
  { id: 'settings',    label: 'Settings',      icon: 'Settings' },
  { id: 'profile',     label: 'Profile',       icon: 'User' },
] as const;

// Page metadata
export const PAGE_META: Record<string, { label: string; action: string | null }> = {
  dashboard:    { label: 'Dashboard',      action: null },
  // Hidden: Prospect is a future product. Quarantine is undefined scope.
  // prospect:     { label: 'Prospect',       action: null },
  normalize:    { label: 'Normalize',      action: null },
  dedup:        { label: 'Dedup',          action: 'Run scan' },
  import:       { label: 'Import',         action: null },
  enrich:       { label: 'Enrich',         action: null },
  // Hidden: Prospect is a future product. Quarantine is undefined scope.
  // quarantine:   { label: 'Quarantine',     action: null },
  harmonies:    { label: 'Harmonies',      action: null },
  connections:  { label: 'Connections',    action: 'Add connection' },
  // Field Mappings removed June 2026 - dormant, replaced by harmony field assignments
  // mappings:     { label: 'Field Mappings', action: null },
  history:      { label: 'History',        action: null },
  settings:     { label: 'Settings',       action: null },
  profile:      { label: 'Profile',        action: null },
};

export type NavItem =
  | { id: string; label: string; icon: string; betaGated?: boolean; divider?: never; group?: never }
  | { divider: true; id?: never; label?: never; icon?: never; group?: never; betaGated?: never }
  | { group: string; id?: never; label?: never; icon?: never; divider?: never; betaGated?: never };

export type ChipColor = 'indigo' | 'green' | 'red' | 'amber';
