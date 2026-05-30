/**
 * Industry Reference Data Seed
 *
 * Comprehensive industry mappings across multiple languages.
 * Includes HubSpot API enum values, display variants, and common misspellings.
 *
 * CRITICAL RULES:
 * 1. Every HubSpot enum value MUST have an identity mapping to itself
 * 2. Every free-text variant maps TO the correct HubSpot enum
 * 3. The `canonical` field MUST ALWAYS be a valid HubSpot industry enum value
 * 4. NEVER use friendly names like "Healthcare" as canonical values
 * 5. ALWAYS use the actual HubSpot enum like "HOSPITAL_HEALTH_CARE"
 */

export interface ReferenceRow {
  input: string;
  canonical: string;
  lang: string;
  fuzzyEligible?: boolean;
}

export const INDUSTRY_SEED: ReferenceRow[] = [
  // ── Healthcare ───────────────────────────────────────────────────

  // Identity mappings for HubSpot enums (fuzzyEligible: false)
  { input: 'HOSPITAL_HEALTH_CARE', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'en', fuzzyEligible: false },
  { input: 'MENTAL_HEALTH_CARE', canonical: 'MENTAL_HEALTH_CARE', lang: 'en', fuzzyEligible: false },
  { input: 'ALTERNATIVE_MEDICINE', canonical: 'ALTERNATIVE_MEDICINE', lang: 'en', fuzzyEligible: false },
  { input: 'MEDICAL_DEVICES', canonical: 'MEDICAL_DEVICES', lang: 'en', fuzzyEligible: false },
  { input: 'PHARMACEUTICALS', canonical: 'PHARMACEUTICALS', lang: 'en', fuzzyEligible: false },
  { input: 'BIOTECHNOLOGY', canonical: 'BIOTECHNOLOGY', lang: 'en', fuzzyEligible: false },
  { input: 'MEDICAL_PRACTICE', canonical: 'MEDICAL_PRACTICE', lang: 'en', fuzzyEligible: false },
  { input: 'VETERINARY', canonical: 'VETERINARY', lang: 'en', fuzzyEligible: false },
  { input: 'HEALTH_WELLNESS_AND_FITNESS', canonical: 'HEALTH_WELLNESS_AND_FITNESS', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum (fuzzyEligible: false)
  { input: 'Hospital & Health Care', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'en', fuzzyEligible: false },
  { input: 'Mental Health Care', canonical: 'MENTAL_HEALTH_CARE', lang: 'en', fuzzyEligible: false },
  { input: 'Alternative Medicine', canonical: 'ALTERNATIVE_MEDICINE', lang: 'en', fuzzyEligible: false },
  { input: 'Medical Devices', canonical: 'MEDICAL_DEVICES', lang: 'en', fuzzyEligible: false },
  { input: 'Pharmaceuticals', canonical: 'PHARMACEUTICALS', lang: 'en', fuzzyEligible: false },
  { input: 'Biotechnology', canonical: 'BIOTECHNOLOGY', lang: 'en', fuzzyEligible: false },
  { input: 'Medical Practice', canonical: 'MEDICAL_PRACTICE', lang: 'en', fuzzyEligible: false },
  { input: 'Veterinary', canonical: 'VETERINARY', lang: 'en', fuzzyEligible: false },
  { input: 'Health, Wellness and Fitness', canonical: 'HEALTH_WELLNESS_AND_FITNESS', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'Healthcare', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'en' },
  { input: 'hospital & health care', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'en' },
  { input: 'health care', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'en' },
  { input: 'healthcare', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'en' },
  { input: 'health & wellness', canonical: 'HEALTH_WELLNESS_AND_FITNESS', lang: 'en' },
  { input: 'wellness', canonical: 'HEALTH_WELLNESS_AND_FITNESS', lang: 'en' },
  { input: 'fitness', canonical: 'HEALTH_WELLNESS_AND_FITNESS', lang: 'en' },
  { input: 'behavioral health', canonical: 'MENTAL_HEALTH_CARE', lang: 'en' },
  { input: 'mental health', canonical: 'MENTAL_HEALTH_CARE', lang: 'en' },
  { input: 'alternative medicine', canonical: 'ALTERNATIVE_MEDICINE', lang: 'en' },
  { input: 'medical devices', canonical: 'MEDICAL_DEVICES', lang: 'en' },
  { input: 'pharmaceuticals', canonical: 'PHARMACEUTICALS', lang: 'en' },
  { input: 'pharma', canonical: 'PHARMACEUTICALS', lang: 'en' },
  { input: 'biotech', canonical: 'BIOTECHNOLOGY', lang: 'en' },
  { input: 'biotechnology', canonical: 'BIOTECHNOLOGY', lang: 'en' },
  { input: 'veterinary', canonical: 'VETERINARY', lang: 'en' },
  { input: 'vet', canonical: 'VETERINARY', lang: 'en' },

  // ABA-specific for Frontera (exact matches have fuzzyEligible: false)
  { input: 'aba', canonical: 'MENTAL_HEALTH_CARE', lang: 'en', fuzzyEligible: false },
  { input: 'ABA', canonical: 'MENTAL_HEALTH_CARE', lang: 'en', fuzzyEligible: false },
  { input: 'aba therapy', canonical: 'MENTAL_HEALTH_CARE', lang: 'en' },
  { input: 'applied behavior analysis', canonical: 'MENTAL_HEALTH_CARE', lang: 'en' },
  { input: 'behavioral health services', canonical: 'MENTAL_HEALTH_CARE', lang: 'en' },

  // Spanish
  { input: 'Salud', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'es' },
  { input: 'Sanidad', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'es' },
  { input: 'Atención sanitaria', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'es' },
  { input: 'Cuidado de la salud', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'es' },
  { input: 'Salud mental', canonical: 'MENTAL_HEALTH_CARE', lang: 'es' },
  { input: 'Farmacéutica', canonical: 'PHARMACEUTICALS', lang: 'es' },
  { input: 'Biotecnología', canonical: 'BIOTECHNOLOGY', lang: 'es' },

  // German
  { input: 'Gesundheitswesen', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'de' },
  { input: 'Krankenpflege', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'de' },
  { input: 'Pharmazeutika', canonical: 'PHARMACEUTICALS', lang: 'de' },
  { input: 'Biotechnologie', canonical: 'BIOTECHNOLOGY', lang: 'de' },

  // French
  { input: 'Santé', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'fr' },
  { input: 'Soins de santé', canonical: 'HOSPITAL_HEALTH_CARE', lang: 'fr' },
  { input: 'Pharmaceutique', canonical: 'PHARMACEUTICALS', lang: 'fr' },
  { input: 'Biotechnologie', canonical: 'BIOTECHNOLOGY', lang: 'fr' },

  // ── Technology ──────────────────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'COMPUTER_SOFTWARE', canonical: 'COMPUTER_SOFTWARE', lang: 'en', fuzzyEligible: false },
  { input: 'INFORMATION_TECHNOLOGY_AND_SERVICES', canonical: 'INFORMATION_TECHNOLOGY_AND_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'INFORMATION_SERVICES', canonical: 'INFORMATION_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'INTERNET', canonical: 'INTERNET', lang: 'en', fuzzyEligible: false },
  { input: 'COMPUTER_NETWORKING', canonical: 'COMPUTER_NETWORKING', lang: 'en', fuzzyEligible: false },
  { input: 'COMPUTER_HARDWARE', canonical: 'COMPUTER_HARDWARE', lang: 'en', fuzzyEligible: false },
  { input: 'SEMICONDUCTORS', canonical: 'SEMICONDUCTORS', lang: 'en', fuzzyEligible: false },
  { input: 'COMPUTER_NETWORK_SECURITY', canonical: 'COMPUTER_NETWORK_SECURITY', lang: 'en', fuzzyEligible: false },
  { input: 'WIRELESS', canonical: 'WIRELESS', lang: 'en', fuzzyEligible: false },
  { input: 'TELECOMMUNICATIONS', canonical: 'TELECOMMUNICATIONS', lang: 'en', fuzzyEligible: false },
  { input: 'NANOTECHNOLOGY', canonical: 'NANOTECHNOLOGY', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Computer Software', canonical: 'COMPUTER_SOFTWARE', lang: 'en', fuzzyEligible: false },
  { input: 'Information Technology and Services', canonical: 'INFORMATION_TECHNOLOGY_AND_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'Information Services', canonical: 'INFORMATION_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'Internet', canonical: 'INTERNET', lang: 'en', fuzzyEligible: false },
  { input: 'Computer Networking', canonical: 'COMPUTER_NETWORKING', lang: 'en', fuzzyEligible: false },
  { input: 'Computer Hardware', canonical: 'COMPUTER_HARDWARE', lang: 'en', fuzzyEligible: false },
  { input: 'Semiconductors', canonical: 'SEMICONDUCTORS', lang: 'en', fuzzyEligible: false },
  { input: 'Computer & Network Security', canonical: 'COMPUTER_NETWORK_SECURITY', lang: 'en', fuzzyEligible: false },
  { input: 'Wireless', canonical: 'WIRELESS', lang: 'en', fuzzyEligible: false },
  { input: 'Telecommunications', canonical: 'TELECOMMUNICATIONS', lang: 'en', fuzzyEligible: false },
  { input: 'Nanotechnology', canonical: 'NANOTECHNOLOGY', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'SaaS', canonical: 'COMPUTER_SOFTWARE', lang: 'en' },
  { input: 'Software', canonical: 'COMPUTER_SOFTWARE', lang: 'en' },
  { input: 'software as a service', canonical: 'COMPUTER_SOFTWARE', lang: 'en' },
  { input: 'B2B Software', canonical: 'COMPUTER_SOFTWARE', lang: 'en' },
  { input: 'Enterprise Software', canonical: 'COMPUTER_SOFTWARE', lang: 'en' },
  { input: 'IT Services', canonical: 'INFORMATION_TECHNOLOGY_AND_SERVICES', lang: 'en' },
  { input: 'Information Technology', canonical: 'INFORMATION_TECHNOLOGY_AND_SERVICES', lang: 'en' },
  { input: 'IT', canonical: 'INFORMATION_TECHNOLOGY_AND_SERVICES', lang: 'en' },
  { input: 'Tech', canonical: 'COMPUTER_SOFTWARE', lang: 'en' },
  { input: 'Technology', canonical: 'COMPUTER_SOFTWARE', lang: 'en' },
  { input: 'internet', canonical: 'INTERNET', lang: 'en' },
  { input: 'cybersecurity', canonical: 'COMPUTER_NETWORK_SECURITY', lang: 'en' },
  { input: 'security', canonical: 'COMPUTER_NETWORK_SECURITY', lang: 'en' },
  { input: 'network security', canonical: 'COMPUTER_NETWORK_SECURITY', lang: 'en' },

  // Spanish
  { input: 'Tecnología', canonical: 'COMPUTER_SOFTWARE', lang: 'es' },
  { input: 'Software', canonical: 'COMPUTER_SOFTWARE', lang: 'es' },
  { input: 'Tecnologías de la información', canonical: 'INFORMATION_TECHNOLOGY_AND_SERVICES', lang: 'es' },

  // French
  { input: 'Technologie', canonical: 'COMPUTER_SOFTWARE', lang: 'fr' },
  { input: 'Logiciel', canonical: 'COMPUTER_SOFTWARE', lang: 'fr' },
  { input: 'Technologies de l\'information', canonical: 'INFORMATION_TECHNOLOGY_AND_SERVICES', lang: 'fr' },

  // German
  { input: 'Technologie', canonical: 'COMPUTER_SOFTWARE', lang: 'de' },
  { input: 'Software', canonical: 'COMPUTER_SOFTWARE', lang: 'de' },
  { input: 'Informationstechnologie', canonical: 'INFORMATION_TECHNOLOGY_AND_SERVICES', lang: 'de' },

  // ── Financial Services ─────────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'BANKING', canonical: 'BANKING', lang: 'en', fuzzyEligible: false },
  { input: 'FINANCIAL_SERVICES', canonical: 'FINANCIAL_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'INVESTMENT_BANKING', canonical: 'INVESTMENT_BANKING', lang: 'en', fuzzyEligible: false },
  { input: 'INVESTMENT_MANAGEMENT', canonical: 'INVESTMENT_MANAGEMENT', lang: 'en', fuzzyEligible: false },
  { input: 'VENTURE_CAPITAL_PRIVATE_EQUITY', canonical: 'VENTURE_CAPITAL_PRIVATE_EQUITY', lang: 'en', fuzzyEligible: false },
  { input: 'INSURANCE', canonical: 'INSURANCE', lang: 'en', fuzzyEligible: false },
  { input: 'CAPITAL_MARKETS', canonical: 'CAPITAL_MARKETS', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Banking', canonical: 'BANKING', lang: 'en', fuzzyEligible: false },
  { input: 'Financial Services', canonical: 'FINANCIAL_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'Investment Banking', canonical: 'INVESTMENT_BANKING', lang: 'en', fuzzyEligible: false },
  { input: 'Investment Management', canonical: 'INVESTMENT_MANAGEMENT', lang: 'en', fuzzyEligible: false },
  { input: 'Venture Capital & Private Equity', canonical: 'VENTURE_CAPITAL_PRIVATE_EQUITY', lang: 'en', fuzzyEligible: false },
  { input: 'Insurance', canonical: 'INSURANCE', lang: 'en', fuzzyEligible: false },
  { input: 'Capital Markets', canonical: 'CAPITAL_MARKETS', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'Finance', canonical: 'FINANCIAL_SERVICES', lang: 'en' },
  { input: 'banking', canonical: 'BANKING', lang: 'en' },
  { input: 'FinTech', canonical: 'FINANCIAL_SERVICES', lang: 'en' },
  { input: 'Financial Technology', canonical: 'FINANCIAL_SERVICES', lang: 'en' },
  { input: 'VC', canonical: 'VENTURE_CAPITAL_PRIVATE_EQUITY', lang: 'en' },
  { input: 'Venture Capital', canonical: 'VENTURE_CAPITAL_PRIVATE_EQUITY', lang: 'en' },
  { input: 'Private Equity', canonical: 'VENTURE_CAPITAL_PRIVATE_EQUITY', lang: 'en' },
  { input: 'PE', canonical: 'VENTURE_CAPITAL_PRIVATE_EQUITY', lang: 'en' },
  { input: 'insurance', canonical: 'INSURANCE', lang: 'en' },

  // Spanish
  { input: 'Servicios financieros', canonical: 'FINANCIAL_SERVICES', lang: 'es' },
  { input: 'Banca', canonical: 'BANKING', lang: 'es' },
  { input: 'Seguros', canonical: 'INSURANCE', lang: 'es' },

  // French
  { input: 'Services financiers', canonical: 'FINANCIAL_SERVICES', lang: 'fr' },
  { input: 'Banque', canonical: 'BANKING', lang: 'fr' },
  { input: 'Assurance', canonical: 'INSURANCE', lang: 'fr' },

  // German
  { input: 'Finanzdienstleistungen', canonical: 'FINANCIAL_SERVICES', lang: 'de' },
  { input: 'Bankwesen', canonical: 'BANKING', lang: 'de' },
  { input: 'Versicherung', canonical: 'INSURANCE', lang: 'de' },

  // ── Education ───────────────────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'EDUCATION_MANAGEMENT', canonical: 'EDUCATION_MANAGEMENT', lang: 'en', fuzzyEligible: false },
  { input: 'HIGHER_EDUCATION', canonical: 'HIGHER_EDUCATION', lang: 'en', fuzzyEligible: false },
  { input: 'PRIMARY_SECONDARY_EDUCATION', canonical: 'PRIMARY_SECONDARY_EDUCATION', lang: 'en', fuzzyEligible: false },
  { input: 'E_LEARNING', canonical: 'E_LEARNING', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Education Management', canonical: 'EDUCATION_MANAGEMENT', lang: 'en', fuzzyEligible: false },
  { input: 'Higher Education', canonical: 'HIGHER_EDUCATION', lang: 'en', fuzzyEligible: false },
  { input: 'Primary/Secondary Education', canonical: 'PRIMARY_SECONDARY_EDUCATION', lang: 'en', fuzzyEligible: false },
  { input: 'E-Learning', canonical: 'E_LEARNING', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'Education', canonical: 'EDUCATION_MANAGEMENT', lang: 'en' },
  { input: 'higher education', canonical: 'HIGHER_EDUCATION', lang: 'en' },
  { input: 'EdTech', canonical: 'E_LEARNING', lang: 'en' },
  { input: 'eLearning', canonical: 'E_LEARNING', lang: 'en' },
  { input: 'Online Learning', canonical: 'E_LEARNING', lang: 'en' },
  { input: 'K-12', canonical: 'PRIMARY_SECONDARY_EDUCATION', lang: 'en' },

  // Spanish
  { input: 'Educación', canonical: 'EDUCATION_MANAGEMENT', lang: 'es' },
  { input: 'Educación superior', canonical: 'HIGHER_EDUCATION', lang: 'es' },

  // French
  { input: 'Éducation', canonical: 'EDUCATION_MANAGEMENT', lang: 'fr' },
  { input: 'Enseignement supérieur', canonical: 'HIGHER_EDUCATION', lang: 'fr' },

  // German
  { input: 'Bildung', canonical: 'EDUCATION_MANAGEMENT', lang: 'de' },
  { input: 'Hochschulwesen', canonical: 'HIGHER_EDUCATION', lang: 'de' },

  // ── Retail & E-Commerce ─────────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'RETAIL', canonical: 'RETAIL', lang: 'en', fuzzyEligible: false },
  { input: 'CONSUMER_GOODS', canonical: 'CONSUMER_GOODS', lang: 'en', fuzzyEligible: false },
  { input: 'CONSUMER_ELECTRONICS', canonical: 'CONSUMER_ELECTRONICS', lang: 'en', fuzzyEligible: false },
  { input: 'APPAREL_FASHION', canonical: 'APPAREL_FASHION', lang: 'en', fuzzyEligible: false },
  { input: 'LUXURY_GOODS_JEWELRY', canonical: 'LUXURY_GOODS_JEWELRY', lang: 'en', fuzzyEligible: false },
  { input: 'SPORTING_GOODS', canonical: 'SPORTING_GOODS', lang: 'en', fuzzyEligible: false },
  { input: 'COSMETICS', canonical: 'COSMETICS', lang: 'en', fuzzyEligible: false },
  { input: 'FOOD_BEVERAGES', canonical: 'FOOD_BEVERAGES', lang: 'en', fuzzyEligible: false },
  { input: 'WINE_AND_SPIRITS', canonical: 'WINE_AND_SPIRITS', lang: 'en', fuzzyEligible: false },
  { input: 'RESTAURANTS', canonical: 'RESTAURANTS', lang: 'en', fuzzyEligible: false },
  { input: 'SUPERMARKETS', canonical: 'SUPERMARKETS', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Retail', canonical: 'RETAIL', lang: 'en', fuzzyEligible: false },
  { input: 'Consumer Goods', canonical: 'CONSUMER_GOODS', lang: 'en', fuzzyEligible: false },
  { input: 'Consumer Electronics', canonical: 'CONSUMER_ELECTRONICS', lang: 'en', fuzzyEligible: false },
  { input: 'Apparel & Fashion', canonical: 'APPAREL_FASHION', lang: 'en', fuzzyEligible: false },
  { input: 'Luxury Goods & Jewelry', canonical: 'LUXURY_GOODS_JEWELRY', lang: 'en', fuzzyEligible: false },
  { input: 'Sporting Goods', canonical: 'SPORTING_GOODS', lang: 'en', fuzzyEligible: false },
  { input: 'Cosmetics', canonical: 'COSMETICS', lang: 'en', fuzzyEligible: false },
  { input: 'Food & Beverages', canonical: 'FOOD_BEVERAGES', lang: 'en', fuzzyEligible: false },
  { input: 'Wine and Spirits', canonical: 'WINE_AND_SPIRITS', lang: 'en', fuzzyEligible: false },
  { input: 'Restaurants', canonical: 'RESTAURANTS', lang: 'en', fuzzyEligible: false },
  { input: 'Supermarkets', canonical: 'SUPERMARKETS', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'retail', canonical: 'RETAIL', lang: 'en' },
  { input: 'eCommerce', canonical: 'RETAIL', lang: 'en' },
  { input: 'E-Commerce', canonical: 'RETAIL', lang: 'en' },
  { input: 'e-commerce', canonical: 'RETAIL', lang: 'en' },
  { input: 'consumer goods', canonical: 'CONSUMER_GOODS', lang: 'en' },
  { input: 'Fashion', canonical: 'APPAREL_FASHION', lang: 'en' },
  { input: 'Apparel', canonical: 'APPAREL_FASHION', lang: 'en' },
  { input: 'Clothing', canonical: 'APPAREL_FASHION', lang: 'en' },
  { input: 'luxury', canonical: 'LUXURY_GOODS_JEWELRY', lang: 'en' },
  { input: 'jewelry', canonical: 'LUXURY_GOODS_JEWELRY', lang: 'en' },
  { input: 'food', canonical: 'FOOD_BEVERAGES', lang: 'en' },
  { input: 'beverages', canonical: 'FOOD_BEVERAGES', lang: 'en' },
  { input: 'restaurants', canonical: 'RESTAURANTS', lang: 'en' },

  // Spanish
  { input: 'Minorista', canonical: 'RETAIL', lang: 'es' },
  { input: 'Comercio electrónico', canonical: 'RETAIL', lang: 'es' },
  { input: 'Moda', canonical: 'APPAREL_FASHION', lang: 'es' },

  // French
  { input: 'Commerce de détail', canonical: 'RETAIL', lang: 'fr' },
  { input: 'Commerce électronique', canonical: 'RETAIL', lang: 'fr' },
  { input: 'Mode', canonical: 'APPAREL_FASHION', lang: 'fr' },

  // German
  { input: 'Einzelhandel', canonical: 'RETAIL', lang: 'de' },
  { input: 'E-Commerce', canonical: 'RETAIL', lang: 'de' },
  { input: 'Mode', canonical: 'APPAREL_FASHION', lang: 'de' },

  // ── Manufacturing ───────────────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'AUTOMOTIVE', canonical: 'AUTOMOTIVE', lang: 'en', fuzzyEligible: false },
  { input: 'AVIATION_AEROSPACE', canonical: 'AVIATION_AEROSPACE', lang: 'en', fuzzyEligible: false },
  { input: 'CHEMICALS', canonical: 'CHEMICALS', lang: 'en', fuzzyEligible: false },
  { input: 'ELECTRICAL_ELECTRONIC_MANUFACTURING', canonical: 'ELECTRICAL_ELECTRONIC_MANUFACTURING', lang: 'en', fuzzyEligible: false },
  { input: 'INDUSTRIAL_AUTOMATION', canonical: 'INDUSTRIAL_AUTOMATION', lang: 'en', fuzzyEligible: false },
  { input: 'MACHINERY', canonical: 'MACHINERY', lang: 'en', fuzzyEligible: false },
  { input: 'PLASTICS', canonical: 'PLASTICS', lang: 'en', fuzzyEligible: false },
  { input: 'TEXTILES', canonical: 'TEXTILES', lang: 'en', fuzzyEligible: false },
  { input: 'PAPER_FOREST_PRODUCTS', canonical: 'PAPER_FOREST_PRODUCTS', lang: 'en', fuzzyEligible: false },
  { input: 'MINING_METALS', canonical: 'MINING_METALS', lang: 'en', fuzzyEligible: false },
  { input: 'OIL_ENERGY', canonical: 'OIL_ENERGY', lang: 'en', fuzzyEligible: false },
  { input: 'RENEWABLES_ENVIRONMENT', canonical: 'RENEWABLES_ENVIRONMENT', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Automotive', canonical: 'AUTOMOTIVE', lang: 'en', fuzzyEligible: false },
  { input: 'Aviation & Aerospace', canonical: 'AVIATION_AEROSPACE', lang: 'en', fuzzyEligible: false },
  { input: 'Chemicals', canonical: 'CHEMICALS', lang: 'en', fuzzyEligible: false },
  { input: 'Electrical/Electronic Manufacturing', canonical: 'ELECTRICAL_ELECTRONIC_MANUFACTURING', lang: 'en', fuzzyEligible: false },
  { input: 'Industrial Automation', canonical: 'INDUSTRIAL_AUTOMATION', lang: 'en', fuzzyEligible: false },
  { input: 'Machinery', canonical: 'MACHINERY', lang: 'en', fuzzyEligible: false },
  { input: 'Plastics', canonical: 'PLASTICS', lang: 'en', fuzzyEligible: false },
  { input: 'Textiles', canonical: 'TEXTILES', lang: 'en', fuzzyEligible: false },
  { input: 'Paper & Forest Products', canonical: 'PAPER_FOREST_PRODUCTS', lang: 'en', fuzzyEligible: false },
  { input: 'Mining & Metals', canonical: 'MINING_METALS', lang: 'en', fuzzyEligible: false },
  { input: 'Oil & Energy', canonical: 'OIL_ENERGY', lang: 'en', fuzzyEligible: false },
  { input: 'Renewables & Environment', canonical: 'RENEWABLES_ENVIRONMENT', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'Manufacturing', canonical: 'MACHINERY', lang: 'en' },
  { input: 'automotive', canonical: 'AUTOMOTIVE', lang: 'en' },
  { input: 'Aviation', canonical: 'AVIATION_AEROSPACE', lang: 'en' },
  { input: 'Aerospace', canonical: 'AVIATION_AEROSPACE', lang: 'en' },
  { input: 'chemicals', canonical: 'CHEMICALS', lang: 'en' },
  { input: 'electronics', canonical: 'ELECTRICAL_ELECTRONIC_MANUFACTURING', lang: 'en' },
  { input: 'automation', canonical: 'INDUSTRIAL_AUTOMATION', lang: 'en' },
  { input: 'machinery', canonical: 'MACHINERY', lang: 'en' },
  { input: 'oil and gas', canonical: 'OIL_ENERGY', lang: 'en' },
  { input: 'energy', canonical: 'OIL_ENERGY', lang: 'en' },
  { input: 'renewable energy', canonical: 'RENEWABLES_ENVIRONMENT', lang: 'en' },
  { input: 'renewables', canonical: 'RENEWABLES_ENVIRONMENT', lang: 'en' },

  // Spanish
  { input: 'Fabricación', canonical: 'MACHINERY', lang: 'es' },
  { input: 'Automoción', canonical: 'AUTOMOTIVE', lang: 'es' },
  { input: 'Aviación', canonical: 'AVIATION_AEROSPACE', lang: 'es' },

  // French
  { input: 'Fabrication', canonical: 'MACHINERY', lang: 'fr' },
  { input: 'Automobile', canonical: 'AUTOMOTIVE', lang: 'fr' },
  { input: 'Aviation', canonical: 'AVIATION_AEROSPACE', lang: 'fr' },

  // German
  { input: 'Fertigung', canonical: 'MACHINERY', lang: 'de' },
  { input: 'Automobilindustrie', canonical: 'AUTOMOTIVE', lang: 'de' },
  { input: 'Luftfahrt', canonical: 'AVIATION_AEROSPACE', lang: 'de' },

  // ── Real Estate & Construction ──────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'REAL_ESTATE', canonical: 'REAL_ESTATE', lang: 'en', fuzzyEligible: false },
  { input: 'COMMERCIAL_REAL_ESTATE', canonical: 'COMMERCIAL_REAL_ESTATE', lang: 'en', fuzzyEligible: false },
  { input: 'CONSTRUCTION', canonical: 'CONSTRUCTION', lang: 'en', fuzzyEligible: false },
  { input: 'ARCHITECTURE_PLANNING', canonical: 'ARCHITECTURE_PLANNING', lang: 'en', fuzzyEligible: false },
  { input: 'CIVIL_ENGINEERING', canonical: 'CIVIL_ENGINEERING', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Real Estate', canonical: 'REAL_ESTATE', lang: 'en', fuzzyEligible: false },
  { input: 'Commercial Real Estate', canonical: 'COMMERCIAL_REAL_ESTATE', lang: 'en', fuzzyEligible: false },
  { input: 'Construction', canonical: 'CONSTRUCTION', lang: 'en', fuzzyEligible: false },
  { input: 'Architecture & Planning', canonical: 'ARCHITECTURE_PLANNING', lang: 'en', fuzzyEligible: false },
  { input: 'Civil Engineering', canonical: 'CIVIL_ENGINEERING', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'real estate', canonical: 'REAL_ESTATE', lang: 'en' },
  { input: 'Property', canonical: 'REAL_ESTATE', lang: 'en' },
  { input: 'construction', canonical: 'CONSTRUCTION', lang: 'en' },
  { input: 'architecture', canonical: 'ARCHITECTURE_PLANNING', lang: 'en' },
  { input: 'engineering', canonical: 'CIVIL_ENGINEERING', lang: 'en' },

  // Spanish
  { input: 'Bienes raíces', canonical: 'REAL_ESTATE', lang: 'es' },
  { input: 'Construcción', canonical: 'CONSTRUCTION', lang: 'es' },

  // French
  { input: 'Immobilier', canonical: 'REAL_ESTATE', lang: 'fr' },
  { input: 'Construction', canonical: 'CONSTRUCTION', lang: 'fr' },

  // German
  { input: 'Immobilien', canonical: 'REAL_ESTATE', lang: 'de' },
  { input: 'Bauwesen', canonical: 'CONSTRUCTION', lang: 'de' },

  // ── Professional Services ───────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'ACCOUNTING', canonical: 'ACCOUNTING', lang: 'en', fuzzyEligible: false },
  { input: 'LEGAL_SERVICES', canonical: 'LEGAL_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'LAW_PRACTICE', canonical: 'LAW_PRACTICE', lang: 'en', fuzzyEligible: false },
  { input: 'MANAGEMENT_CONSULTING', canonical: 'MANAGEMENT_CONSULTING', lang: 'en', fuzzyEligible: false },
  { input: 'MARKETING_AND_ADVERTISING', canonical: 'MARKETING_AND_ADVERTISING', lang: 'en', fuzzyEligible: false },
  { input: 'PUBLIC_RELATIONS_AND_COMMUNICATIONS', canonical: 'PUBLIC_RELATIONS_AND_COMMUNICATIONS', lang: 'en', fuzzyEligible: false },
  { input: 'HUMAN_RESOURCES', canonical: 'HUMAN_RESOURCES', lang: 'en', fuzzyEligible: false },
  { input: 'STAFFING_AND_RECRUITING', canonical: 'STAFFING_AND_RECRUITING', lang: 'en', fuzzyEligible: false },
  { input: 'MARKET_RESEARCH', canonical: 'MARKET_RESEARCH', lang: 'en', fuzzyEligible: false },
  { input: 'GRAPHIC_DESIGN', canonical: 'GRAPHIC_DESIGN', lang: 'en', fuzzyEligible: false },
  { input: 'DESIGN', canonical: 'DESIGN', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Accounting', canonical: 'ACCOUNTING', lang: 'en', fuzzyEligible: false },
  { input: 'Legal Services', canonical: 'LEGAL_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'Law Practice', canonical: 'LAW_PRACTICE', lang: 'en', fuzzyEligible: false },
  { input: 'Management Consulting', canonical: 'MANAGEMENT_CONSULTING', lang: 'en', fuzzyEligible: false },
  { input: 'Marketing and Advertising', canonical: 'MARKETING_AND_ADVERTISING', lang: 'en', fuzzyEligible: false },
  { input: 'Public Relations and Communications', canonical: 'PUBLIC_RELATIONS_AND_COMMUNICATIONS', lang: 'en', fuzzyEligible: false },
  { input: 'Human Resources', canonical: 'HUMAN_RESOURCES', lang: 'en', fuzzyEligible: false },
  { input: 'Staffing and Recruiting', canonical: 'STAFFING_AND_RECRUITING', lang: 'en', fuzzyEligible: false },
  { input: 'Market Research', canonical: 'MARKET_RESEARCH', lang: 'en', fuzzyEligible: false },
  { input: 'Graphic Design', canonical: 'GRAPHIC_DESIGN', lang: 'en', fuzzyEligible: false },
  { input: 'Design', canonical: 'DESIGN', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'Consulting', canonical: 'MANAGEMENT_CONSULTING', lang: 'en' },
  { input: 'Legal', canonical: 'LAW_PRACTICE', lang: 'en' },
  { input: 'Law', canonical: 'LAW_PRACTICE', lang: 'en' },
  { input: 'accounting', canonical: 'ACCOUNTING', lang: 'en' },
  { input: 'Marketing', canonical: 'MARKETING_AND_ADVERTISING', lang: 'en' },
  { input: 'Advertising', canonical: 'MARKETING_AND_ADVERTISING', lang: 'en' },
  { input: 'PR', canonical: 'PUBLIC_RELATIONS_AND_COMMUNICATIONS', lang: 'en' },
  { input: 'Public Relations', canonical: 'PUBLIC_RELATIONS_AND_COMMUNICATIONS', lang: 'en' },
  { input: 'HR', canonical: 'HUMAN_RESOURCES', lang: 'en' },
  { input: 'human resources', canonical: 'HUMAN_RESOURCES', lang: 'en' },
  { input: 'Recruiting', canonical: 'STAFFING_AND_RECRUITING', lang: 'en' },
  { input: 'Staffing', canonical: 'STAFFING_AND_RECRUITING', lang: 'en' },
  { input: 'design', canonical: 'DESIGN', lang: 'en' },

  // Spanish
  { input: 'Consultoría', canonical: 'MANAGEMENT_CONSULTING', lang: 'es' },
  { input: 'Servicios legales', canonical: 'LEGAL_SERVICES', lang: 'es' },
  { input: 'Contabilidad', canonical: 'ACCOUNTING', lang: 'es' },

  // French
  { input: 'Conseil', canonical: 'MANAGEMENT_CONSULTING', lang: 'fr' },
  { input: 'Services juridiques', canonical: 'LEGAL_SERVICES', lang: 'fr' },
  { input: 'Comptabilité', canonical: 'ACCOUNTING', lang: 'fr' },

  // German
  { input: 'Beratung', canonical: 'MANAGEMENT_CONSULTING', lang: 'de' },
  { input: 'Rechtsdienstleistungen', canonical: 'LEGAL_SERVICES', lang: 'de' },
  { input: 'Buchhaltung', canonical: 'ACCOUNTING', lang: 'de' },

  // ── Media & Entertainment ───────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'ENTERTAINMENT', canonical: 'ENTERTAINMENT', lang: 'en', fuzzyEligible: false },
  { input: 'MEDIA_PRODUCTION', canonical: 'MEDIA_PRODUCTION', lang: 'en', fuzzyEligible: false },
  { input: 'BROADCAST_MEDIA', canonical: 'BROADCAST_MEDIA', lang: 'en', fuzzyEligible: false },
  { input: 'ONLINE_MEDIA', canonical: 'ONLINE_MEDIA', lang: 'en', fuzzyEligible: false },
  { input: 'PUBLISHING', canonical: 'PUBLISHING', lang: 'en', fuzzyEligible: false },
  { input: 'NEWSPAPERS', canonical: 'NEWSPAPERS', lang: 'en', fuzzyEligible: false },
  { input: 'MUSIC', canonical: 'MUSIC', lang: 'en', fuzzyEligible: false },
  { input: 'MOTION_PICTURES_AND_FILM', canonical: 'MOTION_PICTURES_AND_FILM', lang: 'en', fuzzyEligible: false },
  { input: 'PERFORMING_ARTS', canonical: 'PERFORMING_ARTS', lang: 'en', fuzzyEligible: false },
  { input: 'FINE_ART', canonical: 'FINE_ART', lang: 'en', fuzzyEligible: false },
  { input: 'PHOTOGRAPHY', canonical: 'PHOTOGRAPHY', lang: 'en', fuzzyEligible: false },
  { input: 'WRITING_AND_EDITING', canonical: 'WRITING_AND_EDITING', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Entertainment', canonical: 'ENTERTAINMENT', lang: 'en', fuzzyEligible: false },
  { input: 'Media Production', canonical: 'MEDIA_PRODUCTION', lang: 'en', fuzzyEligible: false },
  { input: 'Broadcast Media', canonical: 'BROADCAST_MEDIA', lang: 'en', fuzzyEligible: false },
  { input: 'Online Media', canonical: 'ONLINE_MEDIA', lang: 'en', fuzzyEligible: false },
  { input: 'Publishing', canonical: 'PUBLISHING', lang: 'en', fuzzyEligible: false },
  { input: 'Newspapers', canonical: 'NEWSPAPERS', lang: 'en', fuzzyEligible: false },
  { input: 'Music', canonical: 'MUSIC', lang: 'en', fuzzyEligible: false },
  { input: 'Motion Pictures and Film', canonical: 'MOTION_PICTURES_AND_FILM', lang: 'en', fuzzyEligible: false },
  { input: 'Performing Arts', canonical: 'PERFORMING_ARTS', lang: 'en', fuzzyEligible: false },
  { input: 'Fine Art', canonical: 'FINE_ART', lang: 'en', fuzzyEligible: false },
  { input: 'Photography', canonical: 'PHOTOGRAPHY', lang: 'en', fuzzyEligible: false },
  { input: 'Writing and Editing', canonical: 'WRITING_AND_EDITING', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'Media', canonical: 'MEDIA_PRODUCTION', lang: 'en' },
  { input: 'entertainment', canonical: 'ENTERTAINMENT', lang: 'en' },
  { input: 'publishing', canonical: 'PUBLISHING', lang: 'en' },
  { input: 'Film', canonical: 'MOTION_PICTURES_AND_FILM', lang: 'en' },
  { input: 'music', canonical: 'MUSIC', lang: 'en' },
  { input: 'art', canonical: 'FINE_ART', lang: 'en' },

  // Spanish
  { input: 'Medios', canonical: 'MEDIA_PRODUCTION', lang: 'es' },
  { input: 'Entretenimiento', canonical: 'ENTERTAINMENT', lang: 'es' },

  // French
  { input: 'Médias', canonical: 'MEDIA_PRODUCTION', lang: 'fr' },
  { input: 'Divertissement', canonical: 'ENTERTAINMENT', lang: 'fr' },

  // German
  { input: 'Medien', canonical: 'MEDIA_PRODUCTION', lang: 'de' },
  { input: 'Unterhaltung', canonical: 'ENTERTAINMENT', lang: 'de' },

  // ── Non-Profit & Government ─────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'en', fuzzyEligible: false },
  { input: 'PHILANTHROPY', canonical: 'PHILANTHROPY', lang: 'en', fuzzyEligible: false },
  { input: 'FUND_RAISING', canonical: 'FUND_RAISING', lang: 'en', fuzzyEligible: false },
  { input: 'CIVIC_SOCIAL_ORGANIZATION', canonical: 'CIVIC_SOCIAL_ORGANIZATION', lang: 'en', fuzzyEligible: false },
  { input: 'RELIGIOUS_INSTITUTIONS', canonical: 'RELIGIOUS_INSTITUTIONS', lang: 'en', fuzzyEligible: false },
  { input: 'GOVERNMENT_ADMINISTRATION', canonical: 'GOVERNMENT_ADMINISTRATION', lang: 'en', fuzzyEligible: false },
  { input: 'GOVERNMENT_RELATIONS', canonical: 'GOVERNMENT_RELATIONS', lang: 'en', fuzzyEligible: false },
  { input: 'PUBLIC_POLICY', canonical: 'PUBLIC_POLICY', lang: 'en', fuzzyEligible: false },
  { input: 'POLITICAL_ORGANIZATION', canonical: 'POLITICAL_ORGANIZATION', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Non-Profit Organization Management', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'en', fuzzyEligible: false },
  { input: 'Philanthropy', canonical: 'PHILANTHROPY', lang: 'en', fuzzyEligible: false },
  { input: 'Fund-Raising', canonical: 'FUND_RAISING', lang: 'en', fuzzyEligible: false },
  { input: 'Civic & Social Organization', canonical: 'CIVIC_SOCIAL_ORGANIZATION', lang: 'en', fuzzyEligible: false },
  { input: 'Religious Institutions', canonical: 'RELIGIOUS_INSTITUTIONS', lang: 'en', fuzzyEligible: false },
  { input: 'Government Administration', canonical: 'GOVERNMENT_ADMINISTRATION', lang: 'en', fuzzyEligible: false },
  { input: 'Government Relations', canonical: 'GOVERNMENT_RELATIONS', lang: 'en', fuzzyEligible: false },
  { input: 'Public Policy', canonical: 'PUBLIC_POLICY', lang: 'en', fuzzyEligible: false },
  { input: 'Political Organization', canonical: 'POLITICAL_ORGANIZATION', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'Non-Profit', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'en' },
  { input: 'Nonprofit', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'en' },
  { input: 'NGO', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'en' },
  { input: 'Charity', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'en' },
  { input: 'Fundraising', canonical: 'FUND_RAISING', lang: 'en' },
  { input: 'Government', canonical: 'GOVERNMENT_ADMINISTRATION', lang: 'en' },
  { input: 'Public Sector', canonical: 'GOVERNMENT_ADMINISTRATION', lang: 'en' },

  // Spanish
  { input: 'Sin fines de lucro', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'es' },
  { input: 'ONG', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'es' },

  // French
  { input: 'Sans but lucratif', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'fr' },
  { input: 'ONG', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'fr' },

  // German
  { input: 'Gemeinnützig', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'de' },
  { input: 'NGO', canonical: 'NON_PROFIT_ORGANIZATION_MANAGEMENT', lang: 'de' },

  // ── Transportation & Logistics ──────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'LOGISTICS_AND_SUPPLY_CHAIN', canonical: 'LOGISTICS_AND_SUPPLY_CHAIN', lang: 'en', fuzzyEligible: false },
  { input: 'TRANSPORTATION_TRUCKING_RAILROAD', canonical: 'TRANSPORTATION_TRUCKING_RAILROAD', lang: 'en', fuzzyEligible: false },
  { input: 'AIRLINES_AVIATION', canonical: 'AIRLINES_AVIATION', lang: 'en', fuzzyEligible: false },
  { input: 'MARITIME', canonical: 'MARITIME', lang: 'en', fuzzyEligible: false },
  { input: 'PACKAGE_FREIGHT_DELIVERY', canonical: 'PACKAGE_FREIGHT_DELIVERY', lang: 'en', fuzzyEligible: false },
  { input: 'WAREHOUSING', canonical: 'WAREHOUSING', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Logistics and Supply Chain', canonical: 'LOGISTICS_AND_SUPPLY_CHAIN', lang: 'en', fuzzyEligible: false },
  { input: 'Transportation/Trucking/Railroad', canonical: 'TRANSPORTATION_TRUCKING_RAILROAD', lang: 'en', fuzzyEligible: false },
  { input: 'Airlines/Aviation', canonical: 'AIRLINES_AVIATION', lang: 'en', fuzzyEligible: false },
  { input: 'Maritime', canonical: 'MARITIME', lang: 'en', fuzzyEligible: false },
  { input: 'Package/Freight Delivery', canonical: 'PACKAGE_FREIGHT_DELIVERY', lang: 'en', fuzzyEligible: false },
  { input: 'Warehousing', canonical: 'WAREHOUSING', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'Logistics', canonical: 'LOGISTICS_AND_SUPPLY_CHAIN', lang: 'en' },
  { input: 'Supply Chain', canonical: 'LOGISTICS_AND_SUPPLY_CHAIN', lang: 'en' },
  { input: 'Transportation', canonical: 'TRANSPORTATION_TRUCKING_RAILROAD', lang: 'en' },
  { input: 'Trucking', canonical: 'TRANSPORTATION_TRUCKING_RAILROAD', lang: 'en' },
  { input: 'Airlines', canonical: 'AIRLINES_AVIATION', lang: 'en' },
  { input: 'Shipping', canonical: 'MARITIME', lang: 'en' },
  { input: 'Delivery', canonical: 'PACKAGE_FREIGHT_DELIVERY', lang: 'en' },
  { input: 'Freight', canonical: 'PACKAGE_FREIGHT_DELIVERY', lang: 'en' },

  // ── Hospitality & Travel ────────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'HOSPITALITY', canonical: 'HOSPITALITY', lang: 'en', fuzzyEligible: false },
  { input: 'LEISURE_TRAVEL_TOURISM', canonical: 'LEISURE_TRAVEL_TOURISM', lang: 'en', fuzzyEligible: false },
  { input: 'EVENTS_SERVICES', canonical: 'EVENTS_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'RECREATIONAL_FACILITIES_AND_SERVICES', canonical: 'RECREATIONAL_FACILITIES_AND_SERVICES', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Hospitality', canonical: 'HOSPITALITY', lang: 'en', fuzzyEligible: false },
  { input: 'Leisure, Travel & Tourism', canonical: 'LEISURE_TRAVEL_TOURISM', lang: 'en', fuzzyEligible: false },
  { input: 'Events Services', canonical: 'EVENTS_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'Recreational Facilities and Services', canonical: 'RECREATIONAL_FACILITIES_AND_SERVICES', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'hospitality', canonical: 'HOSPITALITY', lang: 'en' },
  { input: 'Travel', canonical: 'LEISURE_TRAVEL_TOURISM', lang: 'en' },
  { input: 'Tourism', canonical: 'LEISURE_TRAVEL_TOURISM', lang: 'en' },
  { input: 'Events', canonical: 'EVENTS_SERVICES', lang: 'en' },
  { input: 'Recreation', canonical: 'RECREATIONAL_FACILITIES_AND_SERVICES', lang: 'en' },

  // ── Agriculture & Natural Resources ─────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'FARMING', canonical: 'FARMING', lang: 'en', fuzzyEligible: false },
  { input: 'RANCHING', canonical: 'RANCHING', lang: 'en', fuzzyEligible: false },
  { input: 'DAIRY', canonical: 'DAIRY', lang: 'en', fuzzyEligible: false },
  { input: 'FISHERY', canonical: 'FISHERY', lang: 'en', fuzzyEligible: false },
  { input: 'FOOD_PRODUCTION', canonical: 'FOOD_PRODUCTION', lang: 'en', fuzzyEligible: false },
  { input: 'ENVIRONMENTAL_SERVICES', canonical: 'ENVIRONMENTAL_SERVICES', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Farming', canonical: 'FARMING', lang: 'en', fuzzyEligible: false },
  { input: 'Ranching', canonical: 'RANCHING', lang: 'en', fuzzyEligible: false },
  { input: 'Dairy', canonical: 'DAIRY', lang: 'en', fuzzyEligible: false },
  { input: 'Fishery', canonical: 'FISHERY', lang: 'en', fuzzyEligible: false },
  { input: 'Food Production', canonical: 'FOOD_PRODUCTION', lang: 'en', fuzzyEligible: false },
  { input: 'Environmental Services', canonical: 'ENVIRONMENTAL_SERVICES', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'Agriculture', canonical: 'FARMING', lang: 'en' },
  { input: 'farming', canonical: 'FARMING', lang: 'en' },
  { input: 'dairy', canonical: 'DAIRY', lang: 'en' },
  { input: 'Environment', canonical: 'ENVIRONMENTAL_SERVICES', lang: 'en' },

  // ── Sports & Gaming ─────────────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'SPORTS', canonical: 'SPORTS', lang: 'en', fuzzyEligible: false },
  { input: 'COMPUTER_GAMES', canonical: 'COMPUTER_GAMES', lang: 'en', fuzzyEligible: false },
  { input: 'MOBILE_GAMES', canonical: 'MOBILE_GAMES', lang: 'en', fuzzyEligible: false },
  { input: 'GAMBLING_CASINOS', canonical: 'GAMBLING_CASINOS', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Sports', canonical: 'SPORTS', lang: 'en', fuzzyEligible: false },
  { input: 'Computer Games', canonical: 'COMPUTER_GAMES', lang: 'en', fuzzyEligible: false },
  { input: 'Mobile Games', canonical: 'MOBILE_GAMES', lang: 'en', fuzzyEligible: false },
  { input: 'Gambling & Casinos', canonical: 'GAMBLING_CASINOS', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'sports', canonical: 'SPORTS', lang: 'en' },
  { input: 'Gaming', canonical: 'COMPUTER_GAMES', lang: 'en' },
  { input: 'Video Games', canonical: 'COMPUTER_GAMES', lang: 'en' },
  { input: 'Mobile Gaming', canonical: 'MOBILE_GAMES', lang: 'en' },
  { input: 'Gambling', canonical: 'GAMBLING_CASINOS', lang: 'en' },
  { input: 'Casinos', canonical: 'GAMBLING_CASINOS', lang: 'en' },

  // ── Other Industries ────────────────────────────────────────────

  // Identity mappings for HubSpot enums
  { input: 'UTILITIES', canonical: 'UTILITIES', lang: 'en', fuzzyEligible: false },
  { input: 'DEFENSE_SPACE', canonical: 'DEFENSE_SPACE', lang: 'en', fuzzyEligible: false },
  { input: 'MILITARY', canonical: 'MILITARY', lang: 'en', fuzzyEligible: false },
  { input: 'PUBLIC_SAFETY', canonical: 'PUBLIC_SAFETY', lang: 'en', fuzzyEligible: false },
  { input: 'LAW_ENFORCEMENT', canonical: 'LAW_ENFORCEMENT', lang: 'en', fuzzyEligible: false },
  { input: 'SECURITY_AND_INVESTIGATIONS', canonical: 'SECURITY_AND_INVESTIGATIONS', lang: 'en', fuzzyEligible: false },
  { input: 'JUDICIARY', canonical: 'JUDICIARY', lang: 'en', fuzzyEligible: false },
  { input: 'LEGISLATIVE_OFFICE', canonical: 'LEGISLATIVE_OFFICE', lang: 'en', fuzzyEligible: false },
  { input: 'EXECUTIVE_OFFICE', canonical: 'EXECUTIVE_OFFICE', lang: 'en', fuzzyEligible: false },
  { input: 'LIBRARIES', canonical: 'LIBRARIES', lang: 'en', fuzzyEligible: false },
  { input: 'MUSEUMS_AND_INSTITUTIONS', canonical: 'MUSEUMS_AND_INSTITUTIONS', lang: 'en', fuzzyEligible: false },
  { input: 'THINK_TANKS', canonical: 'THINK_TANKS', lang: 'en', fuzzyEligible: false },
  { input: 'RESEARCH', canonical: 'RESEARCH', lang: 'en', fuzzyEligible: false },
  { input: 'INTERNATIONAL_AFFAIRS', canonical: 'INTERNATIONAL_AFFAIRS', lang: 'en', fuzzyEligible: false },
  { input: 'INTERNATIONAL_TRADE_AND_DEVELOPMENT', canonical: 'INTERNATIONAL_TRADE_AND_DEVELOPMENT', lang: 'en', fuzzyEligible: false },
  { input: 'IMPORT_AND_EXPORT', canonical: 'IMPORT_AND_EXPORT', lang: 'en', fuzzyEligible: false },
  { input: 'WHOLESALE', canonical: 'WHOLESALE', lang: 'en', fuzzyEligible: false },
  { input: 'OUTSOURCING_OFFSHORING', canonical: 'OUTSOURCING_OFFSHORING', lang: 'en', fuzzyEligible: false },
  { input: 'CONSUMER_SERVICES', canonical: 'CONSUMER_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'INDIVIDUAL_FAMILY_SERVICES', canonical: 'INDIVIDUAL_FAMILY_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'FACILITIES_SERVICES', canonical: 'FACILITIES_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'BUSINESS_SUPPLIES_AND_EQUIPMENT', canonical: 'BUSINESS_SUPPLIES_AND_EQUIPMENT', lang: 'en', fuzzyEligible: false },
  { input: 'FURNITURE', canonical: 'FURNITURE', lang: 'en', fuzzyEligible: false },
  { input: 'BUILDING_MATERIALS', canonical: 'BUILDING_MATERIALS', lang: 'en', fuzzyEligible: false },
  { input: 'GLASS_CERAMICS_CONCRETE', canonical: 'GLASS_CERAMICS_CONCRETE', lang: 'en', fuzzyEligible: false },
  { input: 'PACKAGING_AND_CONTAINERS', canonical: 'PACKAGING_AND_CONTAINERS', lang: 'en', fuzzyEligible: false },
  { input: 'PRINTING', canonical: 'PRINTING', lang: 'en', fuzzyEligible: false },
  { input: 'TOBACCO', canonical: 'TOBACCO', lang: 'en', fuzzyEligible: false },
  { input: 'ANIMATION', canonical: 'ANIMATION', lang: 'en', fuzzyEligible: false },
  { input: 'ARTS_AND_CRAFTS', canonical: 'ARTS_AND_CRAFTS', lang: 'en', fuzzyEligible: false },
  { input: 'PROFESSIONAL_TRAINING_COACHING', canonical: 'PROFESSIONAL_TRAINING_COACHING', lang: 'en', fuzzyEligible: false },
  { input: 'PROGRAM_DEVELOPMENT', canonical: 'PROGRAM_DEVELOPMENT', lang: 'en', fuzzyEligible: false },
  { input: 'TRANSLATION_AND_LOCALIZATION', canonical: 'TRANSLATION_AND_LOCALIZATION', lang: 'en', fuzzyEligible: false },
  { input: 'ALTERNATIVE_DISPUTE_RESOLUTION', canonical: 'ALTERNATIVE_DISPUTE_RESOLUTION', lang: 'en', fuzzyEligible: false },
  { input: 'MECHANICAL_OR_INDUSTRIAL_ENGINEERING', canonical: 'MECHANICAL_OR_INDUSTRIAL_ENGINEERING', lang: 'en', fuzzyEligible: false },
  { input: 'SHIPBUILDING', canonical: 'SHIPBUILDING', lang: 'en', fuzzyEligible: false },
  { input: 'RAILROAD_MANUFACTURE', canonical: 'RAILROAD_MANUFACTURE', lang: 'en', fuzzyEligible: false },

  // HubSpot display labels → HubSpot enum
  { input: 'Utilities', canonical: 'UTILITIES', lang: 'en', fuzzyEligible: false },
  { input: 'Defense & Space', canonical: 'DEFENSE_SPACE', lang: 'en', fuzzyEligible: false },
  { input: 'Military', canonical: 'MILITARY', lang: 'en', fuzzyEligible: false },
  { input: 'Public Safety', canonical: 'PUBLIC_SAFETY', lang: 'en', fuzzyEligible: false },
  { input: 'Law Enforcement', canonical: 'LAW_ENFORCEMENT', lang: 'en', fuzzyEligible: false },
  { input: 'Security and Investigations', canonical: 'SECURITY_AND_INVESTIGATIONS', lang: 'en', fuzzyEligible: false },
  { input: 'Judiciary', canonical: 'JUDICIARY', lang: 'en', fuzzyEligible: false },
  { input: 'Legislative Office', canonical: 'LEGISLATIVE_OFFICE', lang: 'en', fuzzyEligible: false },
  { input: 'Executive Office', canonical: 'EXECUTIVE_OFFICE', lang: 'en', fuzzyEligible: false },
  { input: 'Libraries', canonical: 'LIBRARIES', lang: 'en', fuzzyEligible: false },
  { input: 'Museums and Institutions', canonical: 'MUSEUMS_AND_INSTITUTIONS', lang: 'en', fuzzyEligible: false },
  { input: 'Think Tanks', canonical: 'THINK_TANKS', lang: 'en', fuzzyEligible: false },
  { input: 'Research', canonical: 'RESEARCH', lang: 'en', fuzzyEligible: false },
  { input: 'International Affairs', canonical: 'INTERNATIONAL_AFFAIRS', lang: 'en', fuzzyEligible: false },
  { input: 'International Trade and Development', canonical: 'INTERNATIONAL_TRADE_AND_DEVELOPMENT', lang: 'en', fuzzyEligible: false },
  { input: 'Import and Export', canonical: 'IMPORT_AND_EXPORT', lang: 'en', fuzzyEligible: false },
  { input: 'Wholesale', canonical: 'WHOLESALE', lang: 'en', fuzzyEligible: false },
  { input: 'Outsourcing/Offshoring', canonical: 'OUTSOURCING_OFFSHORING', lang: 'en', fuzzyEligible: false },
  { input: 'Consumer Services', canonical: 'CONSUMER_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'Individual & Family Services', canonical: 'INDIVIDUAL_FAMILY_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'Facilities Services', canonical: 'FACILITIES_SERVICES', lang: 'en', fuzzyEligible: false },
  { input: 'Business Supplies and Equipment', canonical: 'BUSINESS_SUPPLIES_AND_EQUIPMENT', lang: 'en', fuzzyEligible: false },
  { input: 'Furniture', canonical: 'FURNITURE', lang: 'en', fuzzyEligible: false },
  { input: 'Building Materials', canonical: 'BUILDING_MATERIALS', lang: 'en', fuzzyEligible: false },
  { input: 'Glass, Ceramics & Concrete', canonical: 'GLASS_CERAMICS_CONCRETE', lang: 'en', fuzzyEligible: false },
  { input: 'Packaging and Containers', canonical: 'PACKAGING_AND_CONTAINERS', lang: 'en', fuzzyEligible: false },
  { input: 'Printing', canonical: 'PRINTING', lang: 'en', fuzzyEligible: false },
  { input: 'Tobacco', canonical: 'TOBACCO', lang: 'en', fuzzyEligible: false },
  { input: 'Animation', canonical: 'ANIMATION', lang: 'en', fuzzyEligible: false },
  { input: 'Arts and Crafts', canonical: 'ARTS_AND_CRAFTS', lang: 'en', fuzzyEligible: false },
  { input: 'Professional Training & Coaching', canonical: 'PROFESSIONAL_TRAINING_COACHING', lang: 'en', fuzzyEligible: false },
  { input: 'Program Development', canonical: 'PROGRAM_DEVELOPMENT', lang: 'en', fuzzyEligible: false },
  { input: 'Translation and Localization', canonical: 'TRANSLATION_AND_LOCALIZATION', lang: 'en', fuzzyEligible: false },
  { input: 'Alternative Dispute Resolution', canonical: 'ALTERNATIVE_DISPUTE_RESOLUTION', lang: 'en', fuzzyEligible: false },
  { input: 'Mechanical or Industrial Engineering', canonical: 'MECHANICAL_OR_INDUSTRIAL_ENGINEERING', lang: 'en', fuzzyEligible: false },
  { input: 'Shipbuilding', canonical: 'SHIPBUILDING', lang: 'en', fuzzyEligible: false },
  { input: 'Railroad Manufacture', canonical: 'RAILROAD_MANUFACTURE', lang: 'en', fuzzyEligible: false },

  // Free-text variants → HubSpot enum
  { input: 'utilities', canonical: 'UTILITIES', lang: 'en' },
  { input: 'Defense', canonical: 'DEFENSE_SPACE', lang: 'en' },
  { input: 'Space', canonical: 'DEFENSE_SPACE', lang: 'en' },
  { input: 'military', canonical: 'MILITARY', lang: 'en' },
  { input: 'research', canonical: 'RESEARCH', lang: 'en' },
  { input: 'wholesale', canonical: 'WHOLESALE', lang: 'en' },
  { input: 'Outsourcing', canonical: 'OUTSOURCING_OFFSHORING', lang: 'en' },
  { input: 'Offshoring', canonical: 'OUTSOURCING_OFFSHORING', lang: 'en' },
  { input: 'Training', canonical: 'PROFESSIONAL_TRAINING_COACHING', lang: 'en' },
  { input: 'Coaching', canonical: 'PROFESSIONAL_TRAINING_COACHING', lang: 'en' },
];
