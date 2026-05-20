/**
 * Industry Reference Data Seed
 *
 * Comprehensive industry mappings across multiple languages.
 * Includes HubSpot API enum values, display variants, and common misspellings.
 */

export interface ReferenceRow {
  input: string;
  canonical: string;
  lang: string;
  fuzzyEligible?: boolean;
}

export const INDUSTRY_SEED: ReferenceRow[] = [
  // ── Healthcare ───────────────────────────────────────────────────
  // HubSpot API values
  { input: 'HOSPITAL_HEALTH_CARE', canonical: 'Healthcare', lang: 'en' },
  { input: 'MENTAL_HEALTH_CARE', canonical: 'Healthcare', lang: 'en' },
  { input: 'ALTERNATIVE_MEDICINE', canonical: 'Healthcare', lang: 'en' },
  { input: 'MEDICAL_DEVICES', canonical: 'Medical Devices', lang: 'en' },
  { input: 'PHARMACEUTICALS', canonical: 'Healthcare - Pharmaceuticals', lang: 'en' },
  { input: 'BIOTECHNOLOGY', canonical: 'Healthcare - Biotechnology', lang: 'en' },
  { input: 'MEDICAL_PRACTICE', canonical: 'Healthcare', lang: 'en' },
  { input: 'VETERINARY', canonical: 'Healthcare - Veterinary', lang: 'en' },

  // Display variants
  { input: 'hospital & health care', canonical: 'Healthcare', lang: 'en' },
  { input: 'health care', canonical: 'Healthcare', lang: 'en' },
  { input: 'healthcare', canonical: 'Healthcare', lang: 'en' },
  { input: 'health & wellness', canonical: 'Healthcare', lang: 'en' },
  { input: 'behavioral health', canonical: 'Healthcare', lang: 'en' },
  { input: 'mental health', canonical: 'Healthcare', lang: 'en' },
  { input: 'alternative medicine', canonical: 'Healthcare', lang: 'en' },
  { input: 'medical devices', canonical: 'Medical Devices', lang: 'en' },
  { input: 'pharmaceuticals', canonical: 'Healthcare - Pharmaceuticals', lang: 'en' },
  { input: 'pharma', canonical: 'Healthcare - Pharmaceuticals', lang: 'en' },
  { input: 'biotech', canonical: 'Healthcare - Biotechnology', lang: 'en' },
  { input: 'biotechnology', canonical: 'Healthcare - Biotechnology', lang: 'en' },

  // Spanish
  { input: 'Salud', canonical: 'Healthcare', lang: 'es' },
  { input: 'Sanidad', canonical: 'Healthcare', lang: 'es' },
  { input: 'Atención sanitaria', canonical: 'Healthcare', lang: 'es' },
  { input: 'Cuidado de la salud', canonical: 'Healthcare', lang: 'es' },
  { input: 'Salud mental', canonical: 'Healthcare', lang: 'es' },
  { input: 'Farmacéutica', canonical: 'Healthcare - Pharmaceuticals', lang: 'es' },
  { input: 'Biotecnología', canonical: 'Healthcare - Biotechnology', lang: 'es' },

  // German
  { input: 'Gesundheitswesen', canonical: 'Healthcare', lang: 'de' },
  { input: 'Krankenpflege', canonical: 'Healthcare', lang: 'de' },
  { input: 'Pharmazeutika', canonical: 'Healthcare - Pharmaceuticals', lang: 'de' },
  { input: 'Biotechnologie', canonical: 'Healthcare - Biotechnology', lang: 'de' },

  // French
  { input: 'Santé', canonical: 'Healthcare', lang: 'fr' },
  { input: 'Soins de santé', canonical: 'Healthcare', lang: 'fr' },
  { input: 'Pharmaceutique', canonical: 'Healthcare - Pharmaceuticals', lang: 'fr' },
  { input: 'Biotechnologie', canonical: 'Healthcare - Biotechnology', lang: 'fr' },

  // ── Technology ──────────────────────────────────────────────────
  { input: 'COMPUTER_SOFTWARE', canonical: 'Technology', lang: 'en' },
  { input: 'INFORMATION_TECHNOLOGY', canonical: 'Technology', lang: 'en' },
  { input: 'INFORMATION_TECHNOLOGY_SERVICES', canonical: 'Technology', lang: 'en' },
  { input: 'INTERNET', canonical: 'Technology', lang: 'en' },
  { input: 'COMPUTER_NETWORKING', canonical: 'Technology', lang: 'en' },
  { input: 'COMPUTER_HARDWARE', canonical: 'Technology', lang: 'en' },
  { input: 'SEMICONDUCTORS', canonical: 'Technology - Semiconductors', lang: 'en' },

  // Display variants
  { input: 'SaaS', canonical: 'Technology', lang: 'en' },
  { input: 'Software', canonical: 'Technology', lang: 'en' },
  { input: 'software as a service', canonical: 'Technology', lang: 'en' },
  { input: 'B2B Software', canonical: 'Technology', lang: 'en' },
  { input: 'Enterprise Software', canonical: 'Technology', lang: 'en' },
  { input: 'IT Services', canonical: 'Technology', lang: 'en' },
  { input: 'Information Technology', canonical: 'Technology', lang: 'en' },
  { input: 'Computer Software', canonical: 'Technology', lang: 'en' },
  { input: 'Internet', canonical: 'Technology', lang: 'en' },
  { input: 'Tech', canonical: 'Technology', lang: 'en' },

  // Spanish
  { input: 'Tecnología', canonical: 'Technology', lang: 'es' },
  { input: 'Software', canonical: 'Technology', lang: 'es' },
  { input: 'Tecnologías de la información', canonical: 'Technology', lang: 'es' },

  // French
  { input: 'Technologie', canonical: 'Technology', lang: 'fr' },
  { input: 'Logiciel', canonical: 'Technology', lang: 'fr' },
  { input: 'Technologies de l\'information', canonical: 'Technology', lang: 'fr' },

  // German
  { input: 'Technologie', canonical: 'Technology', lang: 'de' },
  { input: 'Software', canonical: 'Technology', lang: 'de' },
  { input: 'Informationstechnologie', canonical: 'Technology', lang: 'de' },

  // ── Financial Services ─────────────────────────────────────────
  { input: 'BANKING', canonical: 'Financial Services', lang: 'en' },
  { input: 'FINANCIAL_SERVICES', canonical: 'Financial Services', lang: 'en' },
  { input: 'INVESTMENT_BANKING', canonical: 'Financial Services', lang: 'en' },
  { input: 'INVESTMENT_MANAGEMENT', canonical: 'Financial Services', lang: 'en' },
  { input: 'VENTURE_CAPITAL', canonical: 'Financial Services - Venture Capital', lang: 'en' },
  { input: 'INSURANCE', canonical: 'Insurance', lang: 'en' },
  { input: 'CAPITAL_MARKETS', canonical: 'Financial Services', lang: 'en' },

  // Display variants
  { input: 'Finance', canonical: 'Financial Services', lang: 'en' },
  { input: 'Banking', canonical: 'Financial Services', lang: 'en' },
  { input: 'FinTech', canonical: 'Financial Services', lang: 'en' },
  { input: 'Financial Technology', canonical: 'Financial Services', lang: 'en' },
  { input: 'VC', canonical: 'Financial Services - Venture Capital', lang: 'en' },
  { input: 'Venture Capital', canonical: 'Financial Services - Venture Capital', lang: 'en' },

  // Spanish
  { input: 'Servicios financieros', canonical: 'Financial Services', lang: 'es' },
  { input: 'Banca', canonical: 'Financial Services', lang: 'es' },
  { input: 'Seguros', canonical: 'Insurance', lang: 'es' },

  // French
  { input: 'Services financiers', canonical: 'Financial Services', lang: 'fr' },
  { input: 'Banque', canonical: 'Financial Services', lang: 'fr' },
  { input: 'Assurance', canonical: 'Insurance', lang: 'fr' },

  // German
  { input: 'Finanzdienstleistungen', canonical: 'Financial Services', lang: 'de' },
  { input: 'Bankwesen', canonical: 'Financial Services', lang: 'de' },
  { input: 'Versicherung', canonical: 'Insurance', lang: 'de' },

  // ── Education ───────────────────────────────────────────────────
  { input: 'EDUCATION_MANAGEMENT', canonical: 'Education', lang: 'en' },
  { input: 'HIGHER_EDUCATION', canonical: 'Education', lang: 'en' },
  { input: 'PRIMARY_SECONDARY_EDUCATION', canonical: 'Education', lang: 'en' },
  { input: 'E_LEARNING', canonical: 'Education - eLearning', lang: 'en' },
  { input: 'EDUCATION', canonical: 'Education', lang: 'en' },

  // Display variants
  { input: 'Education', canonical: 'Education', lang: 'en' },
  { input: 'Higher Education', canonical: 'Education', lang: 'en' },
  { input: 'EdTech', canonical: 'Education - eLearning', lang: 'en' },
  { input: 'eLearning', canonical: 'Education - eLearning', lang: 'en' },
  { input: 'Online Learning', canonical: 'Education - eLearning', lang: 'en' },

  // Spanish
  { input: 'Educación', canonical: 'Education', lang: 'es' },
  { input: 'Educación superior', canonical: 'Education', lang: 'es' },

  // French
  { input: 'Éducation', canonical: 'Education', lang: 'fr' },
  { input: 'Enseignement supérieur', canonical: 'Education', lang: 'fr' },

  // German
  { input: 'Bildung', canonical: 'Education', lang: 'de' },
  { input: 'Hochschulwesen', canonical: 'Education', lang: 'de' },

  // ── Retail ──────────────────────────────────────────────────────
  { input: 'RETAIL', canonical: 'Retail', lang: 'en' },
  { input: 'CONSUMER_GOODS', canonical: 'Retail', lang: 'en' },
  { input: 'CONSUMER_ELECTRONICS', canonical: 'Retail - Consumer Electronics', lang: 'en' },
  { input: 'APPAREL_FASHION', canonical: 'Retail - Apparel & Fashion', lang: 'en' },
  { input: 'LUXURY_GOODS', canonical: 'Retail - Luxury Goods', lang: 'en' },
  { input: 'SPORTING_GOODS', canonical: 'Retail - Sporting Goods', lang: 'en' },

  // Display variants
  { input: 'Retail', canonical: 'Retail', lang: 'en' },
  { input: 'eCommerce', canonical: 'Retail', lang: 'en' },
  { input: 'E-Commerce', canonical: 'Retail', lang: 'en' },
  { input: 'Consumer Goods', canonical: 'Retail', lang: 'en' },
  { input: 'Fashion', canonical: 'Retail - Apparel & Fashion', lang: 'en' },
  { input: 'Apparel', canonical: 'Retail - Apparel & Fashion', lang: 'en' },

  // Spanish
  { input: 'Minorista', canonical: 'Retail', lang: 'es' },
  { input: 'Comercio electrónico', canonical: 'Retail', lang: 'es' },
  { input: 'Moda', canonical: 'Retail - Apparel & Fashion', lang: 'es' },

  // French
  { input: 'Commerce de détail', canonical: 'Retail', lang: 'fr' },
  { input: 'Commerce électronique', canonical: 'Retail', lang: 'fr' },
  { input: 'Mode', canonical: 'Retail - Apparel & Fashion', lang: 'fr' },

  // German
  { input: 'Einzelhandel', canonical: 'Retail', lang: 'de' },
  { input: 'E-Commerce', canonical: 'Retail', lang: 'de' },
  { input: 'Mode', canonical: 'Retail - Apparel & Fashion', lang: 'de' },

  // ── Manufacturing ───────────────────────────────────────────────
  { input: 'AUTOMOTIVE', canonical: 'Manufacturing - Automotive', lang: 'en' },
  { input: 'AVIATION_AEROSPACE', canonical: 'Manufacturing - Aviation & Aerospace', lang: 'en' },
  { input: 'CHEMICALS', canonical: 'Manufacturing - Chemicals', lang: 'en' },
  { input: 'ELECTRICAL_ELECTRONIC_MANUFACTURING', canonical: 'Manufacturing - Electronics', lang: 'en' },
  { input: 'INDUSTRIAL_AUTOMATION', canonical: 'Manufacturing - Industrial Automation', lang: 'en' },
  { input: 'MACHINERY', canonical: 'Manufacturing - Machinery', lang: 'en' },
  { input: 'MANUFACTURING', canonical: 'Manufacturing', lang: 'en' },

  // Display variants
  { input: 'Manufacturing', canonical: 'Manufacturing', lang: 'en' },
  { input: 'Automotive', canonical: 'Manufacturing - Automotive', lang: 'en' },
  { input: 'Aviation', canonical: 'Manufacturing - Aviation & Aerospace', lang: 'en' },
  { input: 'Aerospace', canonical: 'Manufacturing - Aviation & Aerospace', lang: 'en' },
  { input: 'Chemicals', canonical: 'Manufacturing - Chemicals', lang: 'en' },

  // Spanish
  { input: 'Fabricación', canonical: 'Manufacturing', lang: 'es' },
  { input: 'Automoción', canonical: 'Manufacturing - Automotive', lang: 'es' },
  { input: 'Aviación', canonical: 'Manufacturing - Aviation & Aerospace', lang: 'es' },

  // French
  { input: 'Fabrication', canonical: 'Manufacturing', lang: 'fr' },
  { input: 'Automobile', canonical: 'Manufacturing - Automotive', lang: 'fr' },
  { input: 'Aviation', canonical: 'Manufacturing - Aviation & Aerospace', lang: 'fr' },

  // German
  { input: 'Fertigung', canonical: 'Manufacturing', lang: 'de' },
  { input: 'Automobilindustrie', canonical: 'Manufacturing - Automotive', lang: 'de' },
  { input: 'Luftfahrt', canonical: 'Manufacturing - Aviation & Aerospace', lang: 'de' },

  // ── Real Estate ─────────────────────────────────────────────────
  { input: 'REAL_ESTATE', canonical: 'Real Estate', lang: 'en' },
  { input: 'COMMERCIAL_REAL_ESTATE', canonical: 'Real Estate', lang: 'en' },
  { input: 'CONSTRUCTION', canonical: 'Construction', lang: 'en' },

  // Display variants
  { input: 'Real Estate', canonical: 'Real Estate', lang: 'en' },
  { input: 'Property', canonical: 'Real Estate', lang: 'en' },
  { input: 'Construction', canonical: 'Construction', lang: 'en' },

  // Spanish
  { input: 'Bienes raíces', canonical: 'Real Estate', lang: 'es' },
  { input: 'Construcción', canonical: 'Construction', lang: 'es' },

  // French
  { input: 'Immobilier', canonical: 'Real Estate', lang: 'fr' },
  { input: 'Construction', canonical: 'Construction', lang: 'fr' },

  // German
  { input: 'Immobilien', canonical: 'Real Estate', lang: 'de' },
  { input: 'Bauwesen', canonical: 'Construction', lang: 'de' },

  // ── Professional Services ───────────────────────────────────────
  { input: 'ACCOUNTING', canonical: 'Professional Services - Accounting', lang: 'en' },
  { input: 'LEGAL_SERVICES', canonical: 'Professional Services - Legal', lang: 'en' },
  { input: 'MANAGEMENT_CONSULTING', canonical: 'Professional Services - Consulting', lang: 'en' },
  { input: 'MARKETING_ADVERTISING', canonical: 'Professional Services - Marketing', lang: 'en' },
  { input: 'PUBLIC_RELATIONS', canonical: 'Professional Services - PR', lang: 'en' },
  { input: 'HUMAN_RESOURCES', canonical: 'Professional Services - HR', lang: 'en' },

  // Display variants
  { input: 'Consulting', canonical: 'Professional Services - Consulting', lang: 'en' },
  { input: 'Legal', canonical: 'Professional Services - Legal', lang: 'en' },
  { input: 'Law', canonical: 'Professional Services - Legal', lang: 'en' },
  { input: 'Accounting', canonical: 'Professional Services - Accounting', lang: 'en' },
  { input: 'Marketing', canonical: 'Professional Services - Marketing', lang: 'en' },
  { input: 'Advertising', canonical: 'Professional Services - Marketing', lang: 'en' },
  { input: 'PR', canonical: 'Professional Services - PR', lang: 'en' },
  { input: 'Public Relations', canonical: 'Professional Services - PR', lang: 'en' },
  { input: 'HR', canonical: 'Professional Services - HR', lang: 'en' },
  { input: 'Human Resources', canonical: 'Professional Services - HR', lang: 'en' },

  // Spanish
  { input: 'Consultoría', canonical: 'Professional Services - Consulting', lang: 'es' },
  { input: 'Servicios legales', canonical: 'Professional Services - Legal', lang: 'es' },
  { input: 'Contabilidad', canonical: 'Professional Services - Accounting', lang: 'es' },

  // French
  { input: 'Conseil', canonical: 'Professional Services - Consulting', lang: 'fr' },
  { input: 'Services juridiques', canonical: 'Professional Services - Legal', lang: 'fr' },
  { input: 'Comptabilité', canonical: 'Professional Services - Accounting', lang: 'fr' },

  // German
  { input: 'Beratung', canonical: 'Professional Services - Consulting', lang: 'de' },
  { input: 'Rechtsdienstleistungen', canonical: 'Professional Services - Legal', lang: 'de' },
  { input: 'Buchhaltung', canonical: 'Professional Services - Accounting', lang: 'de' },

  // ── Media & Entertainment ───────────────────────────────────────
  { input: 'ENTERTAINMENT', canonical: 'Media & Entertainment', lang: 'en' },
  { input: 'MEDIA_PRODUCTION', canonical: 'Media & Entertainment', lang: 'en' },
  { input: 'BROADCAST_MEDIA', canonical: 'Media & Entertainment', lang: 'en' },
  { input: 'PUBLISHING', canonical: 'Media & Entertainment - Publishing', lang: 'en' },
  { input: 'MUSIC', canonical: 'Media & Entertainment - Music', lang: 'en' },
  { input: 'MOTION_PICTURES', canonical: 'Media & Entertainment - Film', lang: 'en' },

  // Display variants
  { input: 'Media', canonical: 'Media & Entertainment', lang: 'en' },
  { input: 'Entertainment', canonical: 'Media & Entertainment', lang: 'en' },
  { input: 'Publishing', canonical: 'Media & Entertainment - Publishing', lang: 'en' },
  { input: 'Film', canonical: 'Media & Entertainment - Film', lang: 'en' },
  { input: 'Music', canonical: 'Media & Entertainment - Music', lang: 'en' },

  // Spanish
  { input: 'Medios', canonical: 'Media & Entertainment', lang: 'es' },
  { input: 'Entretenimiento', canonical: 'Media & Entertainment', lang: 'es' },

  // French
  { input: 'Médias', canonical: 'Media & Entertainment', lang: 'fr' },
  { input: 'Divertissement', canonical: 'Media & Entertainment', lang: 'fr' },

  // German
  { input: 'Medien', canonical: 'Media & Entertainment', lang: 'de' },
  { input: 'Unterhaltung', canonical: 'Media & Entertainment', lang: 'de' },

  // ── Non-Profit ──────────────────────────────────────────────────
  { input: 'NONPROFIT_ORGANIZATION_MANAGEMENT', canonical: 'Non-Profit', lang: 'en' },
  { input: 'PHILANTHROPIC', canonical: 'Non-Profit', lang: 'en' },
  { input: 'FUNDRAISING', canonical: 'Non-Profit', lang: 'en' },
  { input: 'CIVIC_SOCIAL_ORGANIZATION', canonical: 'Non-Profit', lang: 'en' },
  { input: 'RELIGIOUS_INSTITUTIONS', canonical: 'Non-Profit - Religious', lang: 'en' },

  // Display variants
  { input: 'Non-Profit', canonical: 'Non-Profit', lang: 'en' },
  { input: 'Nonprofit', canonical: 'Non-Profit', lang: 'en' },
  { input: 'NGO', canonical: 'Non-Profit', lang: 'en' },
  { input: 'Charity', canonical: 'Non-Profit', lang: 'en' },

  // Spanish
  { input: 'Sin fines de lucro', canonical: 'Non-Profit', lang: 'es' },
  { input: 'ONG', canonical: 'Non-Profit', lang: 'es' },

  // French
  { input: 'Sans but lucratif', canonical: 'Non-Profit', lang: 'fr' },
  { input: 'ONG', canonical: 'Non-Profit', lang: 'fr' },

  // German
  { input: 'Gemeinnützig', canonical: 'Non-Profit', lang: 'de' },
  { input: 'NGO', canonical: 'Non-Profit', lang: 'de' },
];
