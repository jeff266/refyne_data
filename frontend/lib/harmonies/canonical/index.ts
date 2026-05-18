// Provenance tracking
export {
  // Types
  type ResolutionStrategy,
  type CandidateValue,
  type ResolvedField,

  // Schemas
  ResolutionStrategySchema,
  CandidateValueSchema,
  ResolvedFieldSchema,

  // Functions
  createResolvedField,
  markTransformed,
  resolveField,
  unwrap,

  // Type helpers
  type UnwrapResolved,
} from './provenance';

// Company entity
export {
  // Types
  type EmployeeBand,
  type RevenueBand,
  type Industry,
  type CompanyFields,
  type CanonicalCompany,

  // Schemas
  EmployeeBandSchema,
  RevenueBandSchema,
  IndustrySchema,
  CompanyFieldsSchema,

  // Functions
  createEmptyCompany,
  employeeCountToBand,
  revenueToBand,
  flattenCompany,
  getPopulatedFields as getPopulatedCompanyFields,
} from './company';

// Person entity
export {
  // Types
  type Role,
  type Seniority,
  type EmailStatus,
  type PhoneType,
  type PersonFields,
  type CanonicalPerson,

  // Schemas
  RoleSchema,
  SenioritySchema,
  EmailStatusSchema,
  PhoneTypeSchema,
  PersonFieldsSchema,

  // Functions
  createEmptyPerson,
  detectRole,
  detectSeniority,
  flattenPerson,
  getPopulatedFields as getPopulatedPersonFields,

  // Constants
  ROLE_KEYWORDS,
  SENIORITY_KEYWORDS,
} from './person';
