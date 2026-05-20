/**
 * Legal Suffix Reference Data Seed
 *
 * Company legal entity suffixes across jurisdictions.
 * Used by company-name harmony to normalize "Inc.", "LLC", etc.
 */

import { ReferenceRow } from './industries';

export const LEGAL_SUFFIX_SEED: ReferenceRow[] = [
  // ── United States ───────────────────────────────────────────────
  { input: 'LLC', canonical: 'LLC', lang: 'en', fuzzyEligible: false },
  { input: 'L.L.C.', canonical: 'LLC', lang: 'en', fuzzyEligible: false },
  { input: 'L.L.C', canonical: 'LLC', lang: 'en', fuzzyEligible: false },
  { input: 'Limited Liability Company', canonical: 'LLC', lang: 'en' },

  { input: 'Inc.', canonical: 'Inc', lang: 'en', fuzzyEligible: false },
  { input: 'Inc', canonical: 'Inc', lang: 'en', fuzzyEligible: false },
  { input: 'Incorporated', canonical: 'Inc', lang: 'en' },

  { input: 'Corp.', canonical: 'Corp', lang: 'en', fuzzyEligible: false },
  { input: 'Corp', canonical: 'Corp', lang: 'en', fuzzyEligible: false },
  { input: 'Corporation', canonical: 'Corp', lang: 'en' },

  { input: 'Co.', canonical: 'Co', lang: 'en', fuzzyEligible: false },
  { input: 'Co', canonical: 'Co', lang: 'en', fuzzyEligible: false },
  { input: 'Company', canonical: 'Co', lang: 'en' },

  { input: 'LLP', canonical: 'LLP', lang: 'en', fuzzyEligible: false },
  { input: 'L.L.P.', canonical: 'LLP', lang: 'en', fuzzyEligible: false },
  { input: 'Limited Liability Partnership', canonical: 'LLP', lang: 'en' },

  { input: 'LP', canonical: 'LP', lang: 'en', fuzzyEligible: false },
  { input: 'L.P.', canonical: 'LP', lang: 'en', fuzzyEligible: false },
  { input: 'Limited Partnership', canonical: 'LP', lang: 'en' },

  { input: 'PC', canonical: 'PC', lang: 'en', fuzzyEligible: false },
  { input: 'P.C.', canonical: 'PC', lang: 'en', fuzzyEligible: false },
  { input: 'Professional Corporation', canonical: 'PC', lang: 'en' },

  { input: 'PLLC', canonical: 'PLLC', lang: 'en', fuzzyEligible: false },
  { input: 'P.L.L.C.', canonical: 'PLLC', lang: 'en', fuzzyEligible: false },
  { input: 'Professional Limited Liability Company', canonical: 'PLLC', lang: 'en' },

  // ── United Kingdom ──────────────────────────────────────────────
  { input: 'Ltd', canonical: 'Ltd', lang: 'en-GB', fuzzyEligible: false },
  { input: 'Ltd.', canonical: 'Ltd', lang: 'en-GB', fuzzyEligible: false },
  { input: 'Limited', canonical: 'Ltd', lang: 'en-GB' },

  { input: 'PLC', canonical: 'PLC', lang: 'en-GB', fuzzyEligible: false },
  { input: 'P.L.C.', canonical: 'PLC', lang: 'en-GB', fuzzyEligible: false },
  { input: 'Public Limited Company', canonical: 'PLC', lang: 'en-GB' },

  { input: 'LLP', canonical: 'LLP', lang: 'en-GB', fuzzyEligible: false },
  { input: 'L.L.P.', canonical: 'LLP', lang: 'en-GB', fuzzyEligible: false },
  { input: 'Limited Liability Partnership', canonical: 'LLP', lang: 'en-GB' },

  { input: 'CIC', canonical: 'CIC', lang: 'en-GB', fuzzyEligible: false },
  { input: 'Community Interest Company', canonical: 'CIC', lang: 'en-GB' },

  // ── Spain ───────────────────────────────────────────────────────
  { input: 'S.A.', canonical: 'S.A.', lang: 'es', fuzzyEligible: false },
  { input: 'SA', canonical: 'S.A.', lang: 'es', fuzzyEligible: false },
  { input: 'Sociedad Anónima', canonical: 'S.A.', lang: 'es' },

  { input: 'S.L.', canonical: 'S.L.', lang: 'es', fuzzyEligible: false },
  { input: 'SL', canonical: 'S.L.', lang: 'es', fuzzyEligible: false },
  { input: 'Sociedad Limitada', canonical: 'S.L.', lang: 'es' },

  { input: 'S.L.U.', canonical: 'S.L.U.', lang: 'es', fuzzyEligible: false },
  { input: 'SLU', canonical: 'S.L.U.', lang: 'es', fuzzyEligible: false },
  { input: 'Sociedad Limitada Unipersonal', canonical: 'S.L.U.', lang: 'es' },

  { input: 'S.C.', canonical: 'S.C.', lang: 'es', fuzzyEligible: false },
  { input: 'SC', canonical: 'S.C.', lang: 'es', fuzzyEligible: false },
  { input: 'Sociedad Colectiva', canonical: 'S.C.', lang: 'es' },

  // ── Germany ─────────────────────────────────────────────────────
  { input: 'GmbH', canonical: 'GmbH', lang: 'de', fuzzyEligible: false },
  { input: 'G.m.b.H.', canonical: 'GmbH', lang: 'de', fuzzyEligible: false },
  { input: 'Gesellschaft mit beschränkter Haftung', canonical: 'GmbH', lang: 'de' },

  { input: 'AG', canonical: 'AG', lang: 'de', fuzzyEligible: false },
  { input: 'A.G.', canonical: 'AG', lang: 'de', fuzzyEligible: false },
  { input: 'Aktiengesellschaft', canonical: 'AG', lang: 'de' },

  { input: 'KG', canonical: 'KG', lang: 'de', fuzzyEligible: false },
  { input: 'K.G.', canonical: 'KG', lang: 'de', fuzzyEligible: false },
  { input: 'Kommanditgesellschaft', canonical: 'KG', lang: 'de' },

  { input: 'OHG', canonical: 'OHG', lang: 'de', fuzzyEligible: false },
  { input: 'O.H.G.', canonical: 'OHG', lang: 'de', fuzzyEligible: false },
  { input: 'Offene Handelsgesellschaft', canonical: 'OHG', lang: 'de' },

  { input: 'UG', canonical: 'UG', lang: 'de', fuzzyEligible: false },
  { input: 'Unternehmergesellschaft', canonical: 'UG', lang: 'de' },

  // ── France ──────────────────────────────────────────────────────
  { input: 'SARL', canonical: 'SARL', lang: 'fr', fuzzyEligible: false },
  { input: 'S.A.R.L.', canonical: 'SARL', lang: 'fr', fuzzyEligible: false },
  { input: 'Société à responsabilité limitée', canonical: 'SARL', lang: 'fr' },

  { input: 'SA', canonical: 'SA', lang: 'fr', fuzzyEligible: false },
  { input: 'S.A.', canonical: 'SA', lang: 'fr', fuzzyEligible: false },
  { input: 'Société Anonyme', canonical: 'SA', lang: 'fr' },

  { input: 'SAS', canonical: 'SAS', lang: 'fr', fuzzyEligible: false },
  { input: 'S.A.S.', canonical: 'SAS', lang: 'fr', fuzzyEligible: false },
  { input: 'Société par actions simplifiée', canonical: 'SAS', lang: 'fr' },

  { input: 'SASU', canonical: 'SASU', lang: 'fr', fuzzyEligible: false },
  { input: 'S.A.S.U.', canonical: 'SASU', lang: 'fr', fuzzyEligible: false },
  { input: 'Société par actions simplifiée unipersonnelle', canonical: 'SASU', lang: 'fr' },

  { input: 'SNC', canonical: 'SNC', lang: 'fr', fuzzyEligible: false },
  { input: 'S.N.C.', canonical: 'SNC', lang: 'fr', fuzzyEligible: false },
  { input: 'Société en nom collectif', canonical: 'SNC', lang: 'fr' },

  // ── Italy ───────────────────────────────────────────────────────
  { input: 'S.r.l.', canonical: 'S.r.l.', lang: 'it', fuzzyEligible: false },
  { input: 'Srl', canonical: 'S.r.l.', lang: 'it', fuzzyEligible: false },
  { input: 'Società a responsabilità limitata', canonical: 'S.r.l.', lang: 'it' },

  { input: 'S.p.A.', canonical: 'S.p.A.', lang: 'it', fuzzyEligible: false },
  { input: 'SpA', canonical: 'S.p.A.', lang: 'it', fuzzyEligible: false },
  { input: 'Società per azioni', canonical: 'S.p.A.', lang: 'it' },

  { input: 'S.a.s.', canonical: 'S.a.s.', lang: 'it', fuzzyEligible: false },
  { input: 'Sas', canonical: 'S.a.s.', lang: 'it', fuzzyEligible: false },
  { input: 'Società in accomandita semplice', canonical: 'S.a.s.', lang: 'it' },

  // ── Netherlands ─────────────────────────────────────────────────
  { input: 'B.V.', canonical: 'B.V.', lang: 'nl', fuzzyEligible: false },
  { input: 'BV', canonical: 'B.V.', lang: 'nl', fuzzyEligible: false },
  { input: 'Besloten Vennootschap', canonical: 'B.V.', lang: 'nl' },

  { input: 'N.V.', canonical: 'N.V.', lang: 'nl', fuzzyEligible: false },
  { input: 'NV', canonical: 'N.V.', lang: 'nl', fuzzyEligible: false },
  { input: 'Naamloze Vennootschap', canonical: 'N.V.', lang: 'nl' },

  // ── Belgium ─────────────────────────────────────────────────────
  { input: 'BVBA', canonical: 'BVBA', lang: 'nl', fuzzyEligible: false },
  { input: 'B.V.B.A.', canonical: 'BVBA', lang: 'nl', fuzzyEligible: false },
  { input: 'Besloten vennootschap met beperkte aansprakelijkheid', canonical: 'BVBA', lang: 'nl' },

  { input: 'SPRL', canonical: 'SPRL', lang: 'fr', fuzzyEligible: false },
  { input: 'S.P.R.L.', canonical: 'SPRL', lang: 'fr', fuzzyEligible: false },
  { input: 'Société privée à responsabilité limitée', canonical: 'SPRL', lang: 'fr' },

  // ── Canada ──────────────────────────────────────────────────────
  { input: 'Inc.', canonical: 'Inc', lang: 'en', fuzzyEligible: false },
  { input: 'Incorporated', canonical: 'Inc', lang: 'en' },
  { input: 'Corp.', canonical: 'Corp', lang: 'en', fuzzyEligible: false },
  { input: 'Corporation', canonical: 'Corp', lang: 'en' },
  { input: 'Ltd.', canonical: 'Ltd', lang: 'en', fuzzyEligible: false },
  { input: 'Ltée', canonical: 'Ltée', lang: 'fr', fuzzyEligible: false },
  { input: 'Limitée', canonical: 'Ltée', lang: 'fr' },

  // ── Australia ───────────────────────────────────────────────────
  { input: 'Pty Ltd', canonical: 'Pty Ltd', lang: 'en', fuzzyEligible: false },
  { input: 'Pty. Ltd.', canonical: 'Pty Ltd', lang: 'en', fuzzyEligible: false },
  { input: 'Proprietary Limited', canonical: 'Pty Ltd', lang: 'en' },

  // ── Japan ───────────────────────────────────────────────────────
  { input: 'K.K.', canonical: 'K.K.', lang: 'ja', fuzzyEligible: false },
  { input: 'KK', canonical: 'K.K.', lang: 'ja', fuzzyEligible: false },
  { input: '株式会社', canonical: 'K.K.', lang: 'ja', fuzzyEligible: false },

  { input: 'G.K.', canonical: 'G.K.', lang: 'ja', fuzzyEligible: false },
  { input: 'GK', canonical: 'G.K.', lang: 'ja', fuzzyEligible: false },
  { input: '合同会社', canonical: 'G.K.', lang: 'ja', fuzzyEligible: false },

  // ── China ───────────────────────────────────────────────────────
  { input: '有限公司', canonical: '有限公司', lang: 'zh', fuzzyEligible: false },
  { input: 'Co., Ltd.', canonical: 'Co Ltd', lang: 'en', fuzzyEligible: false },
  { input: 'Ltd.', canonical: 'Ltd', lang: 'en', fuzzyEligible: false },

  // ── Brazil ──────────────────────────────────────────────────────
  { input: 'Ltda.', canonical: 'Ltda', lang: 'pt', fuzzyEligible: false },
  { input: 'Ltda', canonical: 'Ltda', lang: 'pt', fuzzyEligible: false },
  { input: 'Limitada', canonical: 'Ltda', lang: 'pt' },

  { input: 'S.A.', canonical: 'S.A.', lang: 'pt', fuzzyEligible: false },
  { input: 'SA', canonical: 'S.A.', lang: 'pt', fuzzyEligible: false },
  { input: 'Sociedade Anônima', canonical: 'S.A.', lang: 'pt' },

  // ── Mexico ──────────────────────────────────────────────────────
  { input: 'S.A. de C.V.', canonical: 'S.A. de C.V.', lang: 'es', fuzzyEligible: false },
  { input: 'SA de CV', canonical: 'S.A. de C.V.', lang: 'es', fuzzyEligible: false },
  { input: 'Sociedad Anónima de Capital Variable', canonical: 'S.A. de C.V.', lang: 'es' },

  { input: 'S. de R.L. de C.V.', canonical: 'S. de R.L. de C.V.', lang: 'es', fuzzyEligible: false },
  { input: 'SRL de CV', canonical: 'S. de R.L. de C.V.', lang: 'es', fuzzyEligible: false },
  { input: 'Sociedad de Responsabilidad Limitada de Capital Variable', canonical: 'S. de R.L. de C.V.', lang: 'es' },
];
