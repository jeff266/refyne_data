/**
 * Normalization Settings Components - Phase 9
 *
 * UI components for configuring normalization behavior.
 * Supports two modes:
 * - Implicit: Auto-normalize on every pull (simple pipeline config)
 * - Explicit: Preview-then-approve workflow (Insycle-style)
 */

// Mode selection
export { ModeToggle } from './ModeToggle';

// Pipeline configuration
export { PipelineSelector, PipelineManager } from './PipelineSelector';

// Record source (extensible interface)
export { CSVRecordSource } from './RecordSource';
export type { RecordSourceResult, RecordSourceProps } from './RecordSource';

// Preview diff table
export { DiffTable } from './DiffTable';

// Mode-specific panels
export { ImplicitModePanel } from './ImplicitModePanel';
export { ExplicitModePanel } from './ExplicitModePanel';

