// Schema exports
export {
  // Types
  type ErrorPolicy,
  type HarmonyCategory,
  type HarmonyRule,
  type HarmonyTestCase,
  type HarmonyScope,
  type HarmonySpec,
  type ValidatedHarmony,
  type HarmonyValidationResult,
  type HarmonyValidationError,
  type HarmonyValidationWarning,

  // Schemas
  ErrorPolicySchema,
  HarmonyCategorySchema,
  HarmonyRuleSchema,
  HarmonyTestCaseSchema,
  HarmonyScopeSchema,
  HarmonySpecSchema,

  // Functions
  validateHarmonySpec,
  getCanonicalFieldPaths,
  validateFieldPaths,
} from './schema';

// Parser exports
export {
  type ParseResult,

  // Functions
  parseHarmony,
  parseHarmonies,
  serializeHarmony,
  createHarmonyTemplate,
  getHarmonyIdentifier,
  compareHarmonyVersions,
} from './parser';
