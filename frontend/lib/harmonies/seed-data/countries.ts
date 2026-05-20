/**
 * Country Reference Data Seed
 *
 * Maps country names, aliases, and translations to ISO 3166-1 alpha-2 codes.
 * Used by country normalization harmony.
 */

import { ReferenceRow } from './industries';

export const COUNTRIES_SEED: ReferenceRow[] = [
  // ── United States ───────────────────────────────────────────────
  { input: 'United States', canonical: 'US', lang: 'universal', fuzzyEligible: false },
  { input: 'United States of America', canonical: 'US', lang: 'universal' },
  { input: 'USA', canonical: 'US', lang: 'universal', fuzzyEligible: false },
  { input: 'U.S.A.', canonical: 'US', lang: 'universal', fuzzyEligible: false },
  { input: 'U.S.', canonical: 'US', lang: 'universal', fuzzyEligible: false },
  { input: 'US', canonical: 'US', lang: 'universal', fuzzyEligible: false },
  { input: 'Estados Unidos', canonical: 'US', lang: 'es' },
  { input: 'États-Unis', canonical: 'US', lang: 'fr' },
  { input: 'Vereinigte Staaten', canonical: 'US', lang: 'de' },
  { input: 'Stati Uniti', canonical: 'US', lang: 'it' },

  // ── United Kingdom ──────────────────────────────────────────────
  { input: 'United Kingdom', canonical: 'GB', lang: 'universal', fuzzyEligible: false },
  { input: 'UK', canonical: 'GB', lang: 'universal', fuzzyEligible: false },
  { input: 'U.K.', canonical: 'GB', lang: 'universal', fuzzyEligible: false },
  { input: 'GB', canonical: 'GB', lang: 'universal', fuzzyEligible: false },
  { input: 'Britain', canonical: 'GB', lang: 'universal' },
  { input: 'Great Britain', canonical: 'GB', lang: 'universal' },
  { input: 'England', canonical: 'GB', lang: 'universal' },
  { input: 'Reino Unido', canonical: 'GB', lang: 'es' },
  { input: 'Royaume-Uni', canonical: 'GB', lang: 'fr' },
  { input: 'Vereinigtes Königreich', canonical: 'GB', lang: 'de' },
  { input: 'Regno Unito', canonical: 'GB', lang: 'it' },

  // ── Canada ──────────────────────────────────────────────────────
  { input: 'Canada', canonical: 'CA', lang: 'universal', fuzzyEligible: false },
  { input: 'CA', canonical: 'CA', lang: 'universal', fuzzyEligible: false },
  { input: 'Canadá', canonical: 'CA', lang: 'es' },

  // ── Spain ───────────────────────────────────────────────────────
  { input: 'Spain', canonical: 'ES', lang: 'universal', fuzzyEligible: false },
  { input: 'España', canonical: 'ES', lang: 'es', fuzzyEligible: false },
  { input: 'ES', canonical: 'ES', lang: 'universal', fuzzyEligible: false },
  { input: 'Espagne', canonical: 'ES', lang: 'fr' },
  { input: 'Spanien', canonical: 'ES', lang: 'de' },
  { input: 'Spagna', canonical: 'ES', lang: 'it' },

  // ── Germany ─────────────────────────────────────────────────────
  { input: 'Germany', canonical: 'DE', lang: 'universal', fuzzyEligible: false },
  { input: 'Deutschland', canonical: 'DE', lang: 'de', fuzzyEligible: false },
  { input: 'DE', canonical: 'DE', lang: 'universal', fuzzyEligible: false },
  { input: 'Alemania', canonical: 'DE', lang: 'es' },
  { input: 'Allemagne', canonical: 'DE', lang: 'fr' },
  { input: 'Germania', canonical: 'DE', lang: 'it' },

  // ── France ──────────────────────────────────────────────────────
  { input: 'France', canonical: 'FR', lang: 'universal', fuzzyEligible: false },
  { input: 'Francia', canonical: 'FR', lang: 'es' },
  { input: 'Frankreich', canonical: 'FR', lang: 'de' },
  { input: 'FR', canonical: 'FR', lang: 'universal', fuzzyEligible: false },

  // ── Italy ───────────────────────────────────────────────────────
  { input: 'Italy', canonical: 'IT', lang: 'universal', fuzzyEligible: false },
  { input: 'Italia', canonical: 'IT', lang: 'it', fuzzyEligible: false },
  { input: 'IT', canonical: 'IT', lang: 'universal', fuzzyEligible: false },
  { input: 'Italie', canonical: 'IT', lang: 'fr' },
  { input: 'Italien', canonical: 'IT', lang: 'de' },

  // ── Netherlands ─────────────────────────────────────────────────
  { input: 'Netherlands', canonical: 'NL', lang: 'universal', fuzzyEligible: false },
  { input: 'Holland', canonical: 'NL', lang: 'universal' },
  { input: 'The Netherlands', canonical: 'NL', lang: 'universal' },
  { input: 'NL', canonical: 'NL', lang: 'universal', fuzzyEligible: false },
  { input: 'Países Bajos', canonical: 'NL', lang: 'es' },
  { input: 'Pays-Bas', canonical: 'NL', lang: 'fr' },
  { input: 'Niederlande', canonical: 'NL', lang: 'de' },
  { input: 'Paesi Bassi', canonical: 'NL', lang: 'it' },

  // ── Belgium ─────────────────────────────────────────────────────
  { input: 'Belgium', canonical: 'BE', lang: 'universal', fuzzyEligible: false },
  { input: 'België', canonical: 'BE', lang: 'nl' },
  { input: 'Belgique', canonical: 'BE', lang: 'fr' },
  { input: 'BE', canonical: 'BE', lang: 'universal', fuzzyEligible: false },
  { input: 'Bélgica', canonical: 'BE', lang: 'es' },
  { input: 'Belgien', canonical: 'BE', lang: 'de' },
  { input: 'Belgio', canonical: 'BE', lang: 'it' },

  // ── Switzerland ─────────────────────────────────────────────────
  { input: 'Switzerland', canonical: 'CH', lang: 'universal', fuzzyEligible: false },
  { input: 'Schweiz', canonical: 'CH', lang: 'de' },
  { input: 'Suisse', canonical: 'CH', lang: 'fr' },
  { input: 'Svizzera', canonical: 'CH', lang: 'it' },
  { input: 'CH', canonical: 'CH', lang: 'universal', fuzzyEligible: false },
  { input: 'Suiza', canonical: 'CH', lang: 'es' },

  // ── Austria ─────────────────────────────────────────────────────
  { input: 'Austria', canonical: 'AT', lang: 'universal', fuzzyEligible: false },
  { input: 'Österreich', canonical: 'AT', lang: 'de' },
  { input: 'AT', canonical: 'AT', lang: 'universal', fuzzyEligible: false },
  { input: 'Autriche', canonical: 'AT', lang: 'fr' },

  // ── Australia ───────────────────────────────────────────────────
  { input: 'Australia', canonical: 'AU', lang: 'universal', fuzzyEligible: false },
  { input: 'AU', canonical: 'AU', lang: 'universal', fuzzyEligible: false },
  { input: 'Australie', canonical: 'AU', lang: 'fr' },
  { input: 'Australien', canonical: 'AU', lang: 'de' },

  // ── New Zealand ─────────────────────────────────────────────────
  { input: 'New Zealand', canonical: 'NZ', lang: 'universal', fuzzyEligible: false },
  { input: 'NZ', canonical: 'NZ', lang: 'universal', fuzzyEligible: false },
  { input: 'Nueva Zelanda', canonical: 'NZ', lang: 'es' },
  { input: 'Nouvelle-Zélande', canonical: 'NZ', lang: 'fr' },
  { input: 'Neuseeland', canonical: 'NZ', lang: 'de' },

  // ── Japan ───────────────────────────────────────────────────────
  { input: 'Japan', canonical: 'JP', lang: 'universal', fuzzyEligible: false },
  { input: '日本', canonical: 'JP', lang: 'ja', fuzzyEligible: false },
  { input: 'JP', canonical: 'JP', lang: 'universal', fuzzyEligible: false },
  { input: 'Japón', canonical: 'JP', lang: 'es' },
  { input: 'Japon', canonical: 'JP', lang: 'fr' },
  { input: 'Japan', canonical: 'JP', lang: 'de' },

  // ── China ───────────────────────────────────────────────────────
  { input: 'China', canonical: 'CN', lang: 'universal', fuzzyEligible: false },
  { input: '中国', canonical: 'CN', lang: 'zh', fuzzyEligible: false },
  { input: 'CN', canonical: 'CN', lang: 'universal', fuzzyEligible: false },
  { input: 'Chine', canonical: 'CN', lang: 'fr' },

  // ── India ───────────────────────────────────────────────────────
  { input: 'India', canonical: 'IN', lang: 'universal', fuzzyEligible: false },
  { input: 'IN', canonical: 'IN', lang: 'universal', fuzzyEligible: false },
  { input: 'Inde', canonical: 'IN', lang: 'fr' },
  { input: 'Indien', canonical: 'IN', lang: 'de' },

  // ── Brazil ──────────────────────────────────────────────────────
  { input: 'Brazil', canonical: 'BR', lang: 'universal', fuzzyEligible: false },
  { input: 'Brasil', canonical: 'BR', lang: 'pt', fuzzyEligible: false },
  { input: 'BR', canonical: 'BR', lang: 'universal', fuzzyEligible: false },
  { input: 'Brésil', canonical: 'BR', lang: 'fr' },
  { input: 'Brasilien', canonical: 'BR', lang: 'de' },
  { input: 'Brasile', canonical: 'BR', lang: 'it' },

  // ── Mexico ──────────────────────────────────────────────────────
  { input: 'Mexico', canonical: 'MX', lang: 'universal', fuzzyEligible: false },
  { input: 'México', canonical: 'MX', lang: 'es', fuzzyEligible: false },
  { input: 'MX', canonical: 'MX', lang: 'universal', fuzzyEligible: false },
  { input: 'Mexique', canonical: 'MX', lang: 'fr' },
  { input: 'Mexiko', canonical: 'MX', lang: 'de' },
  { input: 'Messico', canonical: 'MX', lang: 'it' },

  // ── Argentina ───────────────────────────────────────────────────
  { input: 'Argentina', canonical: 'AR', lang: 'universal', fuzzyEligible: false },
  { input: 'AR', canonical: 'AR', lang: 'universal', fuzzyEligible: false },
  { input: 'Argentine', canonical: 'AR', lang: 'fr' },
  { input: 'Argentinien', canonical: 'AR', lang: 'de' },

  // ── Portugal ────────────────────────────────────────────────────
  { input: 'Portugal', canonical: 'PT', lang: 'universal', fuzzyEligible: false },
  { input: 'PT', canonical: 'PT', lang: 'universal', fuzzyEligible: false },
  { input: 'Portogallo', canonical: 'PT', lang: 'it' },

  // ── Poland ──────────────────────────────────────────────────────
  { input: 'Poland', canonical: 'PL', lang: 'universal', fuzzyEligible: false },
  { input: 'Polska', canonical: 'PL', lang: 'pl', fuzzyEligible: false },
  { input: 'PL', canonical: 'PL', lang: 'universal', fuzzyEligible: false },
  { input: 'Polonia', canonical: 'PL', lang: 'es' },
  { input: 'Pologne', canonical: 'PL', lang: 'fr' },
  { input: 'Polen', canonical: 'PL', lang: 'de' },

  // ── Sweden ──────────────────────────────────────────────────────
  { input: 'Sweden', canonical: 'SE', lang: 'universal', fuzzyEligible: false },
  { input: 'Sverige', canonical: 'SE', lang: 'sv', fuzzyEligible: false },
  { input: 'SE', canonical: 'SE', lang: 'universal', fuzzyEligible: false },
  { input: 'Suecia', canonical: 'SE', lang: 'es' },
  { input: 'Suède', canonical: 'SE', lang: 'fr' },
  { input: 'Schweden', canonical: 'SE', lang: 'de' },
  { input: 'Svezia', canonical: 'SE', lang: 'it' },

  // ── Norway ──────────────────────────────────────────────────────
  { input: 'Norway', canonical: 'NO', lang: 'universal', fuzzyEligible: false },
  { input: 'Norge', canonical: 'NO', lang: 'no', fuzzyEligible: false },
  { input: 'NO', canonical: 'NO', lang: 'universal', fuzzyEligible: false },
  { input: 'Noruega', canonical: 'NO', lang: 'es' },
  { input: 'Norvège', canonical: 'NO', lang: 'fr' },
  { input: 'Norwegen', canonical: 'NO', lang: 'de' },
  { input: 'Norvegia', canonical: 'NO', lang: 'it' },

  // ── Denmark ─────────────────────────────────────────────────────
  { input: 'Denmark', canonical: 'DK', lang: 'universal', fuzzyEligible: false },
  { input: 'Danmark', canonical: 'DK', lang: 'da', fuzzyEligible: false },
  { input: 'DK', canonical: 'DK', lang: 'universal', fuzzyEligible: false },
  { input: 'Dinamarca', canonical: 'DK', lang: 'es' },
  { input: 'Danemark', canonical: 'DK', lang: 'fr' },
  { input: 'Dänemark', canonical: 'DK', lang: 'de' },
  { input: 'Danimarca', canonical: 'DK', lang: 'it' },

  // ── Finland ─────────────────────────────────────────────────────
  { input: 'Finland', canonical: 'FI', lang: 'universal', fuzzyEligible: false },
  { input: 'Suomi', canonical: 'FI', lang: 'fi', fuzzyEligible: false },
  { input: 'FI', canonical: 'FI', lang: 'universal', fuzzyEligible: false },
  { input: 'Finlandia', canonical: 'FI', lang: 'es' },
  { input: 'Finlande', canonical: 'FI', lang: 'fr' },
  { input: 'Finnland', canonical: 'FI', lang: 'de' },

  // ── Ireland ─────────────────────────────────────────────────────
  { input: 'Ireland', canonical: 'IE', lang: 'universal', fuzzyEligible: false },
  { input: 'IE', canonical: 'IE', lang: 'universal', fuzzyEligible: false },
  { input: 'Irlanda', canonical: 'IE', lang: 'es' },
  { input: 'Irlande', canonical: 'IE', lang: 'fr' },
  { input: 'Irland', canonical: 'IE', lang: 'de' },

  // ── Greece ──────────────────────────────────────────────────────
  { input: 'Greece', canonical: 'GR', lang: 'universal', fuzzyEligible: false },
  { input: 'Ελλάδα', canonical: 'GR', lang: 'el', fuzzyEligible: false },
  { input: 'GR', canonical: 'GR', lang: 'universal', fuzzyEligible: false },
  { input: 'Grecia', canonical: 'GR', lang: 'es' },
  { input: 'Grèce', canonical: 'GR', lang: 'fr' },
  { input: 'Griechenland', canonical: 'GR', lang: 'de' },

  // ── Russia ──────────────────────────────────────────────────────
  { input: 'Russia', canonical: 'RU', lang: 'universal', fuzzyEligible: false },
  { input: 'Россия', canonical: 'RU', lang: 'ru', fuzzyEligible: false },
  { input: 'RU', canonical: 'RU', lang: 'universal', fuzzyEligible: false },
  { input: 'Rusia', canonical: 'RU', lang: 'es' },
  { input: 'Russie', canonical: 'RU', lang: 'fr' },
  { input: 'Russland', canonical: 'RU', lang: 'de' },

  // ── South Korea ─────────────────────────────────────────────────
  { input: 'South Korea', canonical: 'KR', lang: 'universal', fuzzyEligible: false },
  { input: 'Korea', canonical: 'KR', lang: 'universal' },
  { input: '대한민국', canonical: 'KR', lang: 'ko', fuzzyEligible: false },
  { input: 'KR', canonical: 'KR', lang: 'universal', fuzzyEligible: false },
  { input: 'Corea del Sur', canonical: 'KR', lang: 'es' },
  { input: 'Corée du Sud', canonical: 'KR', lang: 'fr' },
  { input: 'Südkorea', canonical: 'KR', lang: 'de' },

  // ── Singapore ───────────────────────────────────────────────────
  { input: 'Singapore', canonical: 'SG', lang: 'universal', fuzzyEligible: false },
  { input: 'SG', canonical: 'SG', lang: 'universal', fuzzyEligible: false },
  { input: 'Singapur', canonical: 'SG', lang: 'es' },
  { input: 'Singapour', canonical: 'SG', lang: 'fr' },

  // ── South Africa ────────────────────────────────────────────────
  { input: 'South Africa', canonical: 'ZA', lang: 'universal', fuzzyEligible: false },
  { input: 'ZA', canonical: 'ZA', lang: 'universal', fuzzyEligible: false },
  { input: 'Sudáfrica', canonical: 'ZA', lang: 'es' },
  { input: 'Afrique du Sud', canonical: 'ZA', lang: 'fr' },
  { input: 'Südafrika', canonical: 'ZA', lang: 'de' },

  // ── Israel ──────────────────────────────────────────────────────
  { input: 'Israel', canonical: 'IL', lang: 'universal', fuzzyEligible: false },
  { input: 'IL', canonical: 'IL', lang: 'universal', fuzzyEligible: false },
  { input: 'ישראל', canonical: 'IL', lang: 'he', fuzzyEligible: false },
  { input: 'Israël', canonical: 'IL', lang: 'fr' },

  // ── United Arab Emirates ────────────────────────────────────────
  { input: 'United Arab Emirates', canonical: 'AE', lang: 'universal', fuzzyEligible: false },
  { input: 'UAE', canonical: 'AE', lang: 'universal', fuzzyEligible: false },
  { input: 'AE', canonical: 'AE', lang: 'universal', fuzzyEligible: false },
  { input: 'Emiratos Árabes Unidos', canonical: 'AE', lang: 'es' },
  { input: 'Émirats arabes unis', canonical: 'AE', lang: 'fr' },

  // ── Turkey ──────────────────────────────────────────────────────
  { input: 'Turkey', canonical: 'TR', lang: 'universal', fuzzyEligible: false },
  { input: 'Türkiye', canonical: 'TR', lang: 'tr', fuzzyEligible: false },
  { input: 'TR', canonical: 'TR', lang: 'universal', fuzzyEligible: false },
  { input: 'Turquía', canonical: 'TR', lang: 'es' },
  { input: 'Turquie', canonical: 'TR', lang: 'fr' },
  { input: 'Türkei', canonical: 'TR', lang: 'de' },

  // ── Czech Republic ──────────────────────────────────────────────
  { input: 'Czech Republic', canonical: 'CZ', lang: 'universal', fuzzyEligible: false },
  { input: 'Czechia', canonical: 'CZ', lang: 'universal' },
  { input: 'CZ', canonical: 'CZ', lang: 'universal', fuzzyEligible: false },
  { input: 'República Checa', canonical: 'CZ', lang: 'es' },
  { input: 'République tchèque', canonical: 'CZ', lang: 'fr' },
  { input: 'Tschechien', canonical: 'CZ', lang: 'de' },

  // ── Romania ─────────────────────────────────────────────────────
  { input: 'Romania', canonical: 'RO', lang: 'universal', fuzzyEligible: false },
  { input: 'România', canonical: 'RO', lang: 'ro', fuzzyEligible: false },
  { input: 'RO', canonical: 'RO', lang: 'universal', fuzzyEligible: false },
  { input: 'Rumania', canonical: 'RO', lang: 'es' },
  { input: 'Roumanie', canonical: 'RO', lang: 'fr' },
  { input: 'Rumänien', canonical: 'RO', lang: 'de' },

  // ── Chile ───────────────────────────────────────────────────────
  { input: 'Chile', canonical: 'CL', lang: 'universal', fuzzyEligible: false },
  { input: 'CL', canonical: 'CL', lang: 'universal', fuzzyEligible: false },
  { input: 'Chili', canonical: 'CL', lang: 'fr' },

  // ── Colombia ────────────────────────────────────────────────────
  { input: 'Colombia', canonical: 'CO', lang: 'universal', fuzzyEligible: false },
  { input: 'CO', canonical: 'CO', lang: 'universal', fuzzyEligible: false },
  { input: 'Colombie', canonical: 'CO', lang: 'fr' },
  { input: 'Kolumbien', canonical: 'CO', lang: 'de' },

  // ── Peru ────────────────────────────────────────────────────────
  { input: 'Peru', canonical: 'PE', lang: 'universal', fuzzyEligible: false },
  { input: 'Perú', canonical: 'PE', lang: 'es', fuzzyEligible: false },
  { input: 'PE', canonical: 'PE', lang: 'universal', fuzzyEligible: false },
  { input: 'Pérou', canonical: 'PE', lang: 'fr' },
];
