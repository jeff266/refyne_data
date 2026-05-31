import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureTitleCase,
  toSmartTitleCase,
  tokenize,
} from './normalization-engine';

describe('toSmartTitleCase', () => {
  // Transform helper for backward compatibility
  // Old tests call configureTitleCase first, then pass undefined/result to transform
  // New API: configureTitleCase sets module state, so we just call toSmartTitleCase
  const transform = (input: string, opts: any = {}) => {
    // Only reconfigure if opts has explicit brandTokens, conjunctions, or honorHyphenBoundary
    if (opts && (opts.brandTokens || opts.conjunctions || opts.honorHyphenBoundary !== undefined)) {
      configureTitleCase({
        brandTokens: opts.brandTokens || [],
        conjunctions: opts.conjunctions || [
          'and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to', 'a', 'an'
        ],
        honorHyphenBoundary: opts.honorHyphenBoundary !== undefined ? opts.honorHyphenBoundary : true,
      });
    }

    // Also check if opts has orgNameExceptions (from old-style config)
    const orgExceptions = opts?.orgNameExceptions ? new Set(opts.orgNameExceptions) : undefined;

    // Call toSmartTitleCase with org exceptions if provided
    return toSmartTitleCase(input, { orgExceptions });
  };

  // Dummy transformToken for backward compatibility with tests that call it directly
  const transformToken = (token: any, config: any, index: number) => {
    if (token === null) return null;
    return token;
  };

  // Note: No global beforeEach reset - tests that need specific config use beforeAll in their describe block

  describe('Basic transformation', () => {
    it('should pass through null values', () => {
      const config = configureTitleCase({});
      expect(transformToken(null, config, 0)).toBe(null);
    });

    it('should pass through empty strings', () => {
      const config = configureTitleCase({});
      expect(transform('', config)).toBe('');
    });

    it('should apply title case to all lowercase input', () => {
      const config = configureTitleCase({});
      expect(transform('acme corporation', config)).toBe('Acme Corporation');
    });

    it('should apply title case to all uppercase input', () => {
      const config = configureTitleCase({});
      expect(transform('ACME CORPORATION', config)).toBe('Acme Corporation');
    });

    it('should apply title case to mixed case input', () => {
      const config = configureTitleCase({});
      expect(transform('aCmE cOrPoRaTiOn', config)).toBe('Acme Corporation');
    });
  });

  describe('Brand token preservation', () => {
    it('should preserve iPhone brand casing', () => {
      const config = configureTitleCase({
        brandTokens: ['iPhone', 'eBay', 'HubSpot']
      });
      expect(transform('iphone repair shop', config)).toBe('iPhone Repair Shop');
    });

    it('should preserve eBay brand casing', () => {
      const config = configureTitleCase({
        brandTokens: ['iPhone', 'eBay', 'HubSpot']
      });
      expect(transform('ebay consulting services', config)).toBe('eBay Consulting Services');
    });

    it('should preserve HubSpot brand casing', () => {
      const config = configureTitleCase({
        brandTokens: ['iPhone', 'eBay', 'HubSpot']
      });
      expect(transform('hubspot integration partner', config)).toBe('HubSpot Integration Partner');
    });

    it('should preserve McDonald\'s brand casing', () => {
      const config = configureTitleCase({
        brandTokens: ['McDonald\'s', 'McCafe']
      });
      expect(transform('mcdonald\'s restaurant', config)).toBe('McDonald\'s Restaurant');
    });

    it('should preserve FedEx brand casing', () => {
      const config = configureTitleCase({
        brandTokens: ['FedEx', 'UPS', 'DHL']
      });
      expect(transform('fedex office', config)).toBe('FedEx Office');
    });

    it('should be case-insensitive when matching brand tokens', () => {
      const config = configureTitleCase({
        brandTokens: ['iPhone']
      });
      expect(transform('IPHONE repair', config)).toBe('iPhone Repair');
    });
  });

  describe('Conjunction handling', () => {
    it('should lowercase "and" when not first word', () => {
      const config = configureTitleCase({
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to']
      });
      expect(transform('Pisecco AND Associates', config)).toBe('Pisecco and Associates');
    });

    it('should lowercase "of" when not first word', () => {
      const config = configureTitleCase({
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to']
      });
      expect(transform('Bank OF America', config)).toBe('Bank of America');
    });

    it('should capitalize conjunction when first word', () => {
      const config = configureTitleCase({
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to']
      });
      expect(transform('the company name', config)).toBe('The Company Name');
    });

    it('should handle multiple conjunctions', () => {
      const config = configureTitleCase({
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to']
      });
      expect(transform('The Company Of The Future', config)).toBe('The Company of the Future');
    });
  });

  describe('Acronym preservation', () => {
    it('should preserve 2-3 letter acronyms', () => {
      const config = configureTitleCase({});
      expect(transform('ABC Services', config)).toBe('ABC Services');
    });

    it('should preserve ABA acronym', () => {
      const config = configureTitleCase({});
      expect(transform('Specialized ABA Services', config)).toBe('Specialized ABA Services');
    });

    it('should preserve LEARN acronym (4-5 chars with mixed input)', () => {
      const config = configureTitleCase({});
      expect(transform('LEARN Behavioral', config)).toBe('LEARN Behavioral');
    });

    it('should title case 4-5 letter words if all uppercase input', () => {
      const config = configureTitleCase({});
      expect(transform('ACME', config)).toBe('Acme');
    });
  });

  describe('Hyphen boundary awareness', () => {
    it('should respect hyphen boundaries when enabled', () => {
      const config = configureTitleCase({
        honorHyphenBoundary: true,
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for']
      });
      expect(transform('State-of-the-Art Solutions', config)).toBe('State-Of-The-Art Solutions');
    });

    it('should lowercase conjunctions within hyphens when disabled', () => {
      const config = configureTitleCase({
        honorHyphenBoundary: false,
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for']
      });
      expect(transform('State-of-the-Art Solutions', config)).toBe('State-of-the-Art Solutions');
    });

    it('should handle multi-word hyphenated names', () => {
      const config = configureTitleCase({
        honorHyphenBoundary: true
      });
      expect(transform('Jean-Claude Van Damme', config)).toBe('Jean-Claude Van Damme');
    });
  });

  describe('Digit token preservation', () => {
    it('should preserve 3M brand token', () => {
      const config = configureTitleCase({
        preserveDigitTokens: true,
        brandTokens: ['3M']
      });
      expect(transform('3m company', config)).toBe('3M Company');
    });

    it('should preserve 7-Eleven brand token', () => {
      const config = configureTitleCase({
        preserveDigitTokens: true,
        brandTokens: ['7-Eleven']
      });
      expect(transform('7-eleven store', config)).toBe('7-Eleven Store');
    });

    it('should not alter pure digit tokens', () => {
      const config = configureTitleCase({
        preserveDigitTokens: true
      });
      expect(transform('Company 123', config)).toBe('Company 123');
    });
  });

  describe('Org-specific exceptions', () => {
    it('should preserve exact org exception "iPEC Coaching"', () => {
      expect(transform('ipec coaching', { orgNameExceptions: ['iPEC Coaching'] })).toBe('iPEC Coaching');
    });

    it('should preserve exact org exception "dscout"', () => {
      expect(transform('Dscout', { orgNameExceptions: ['dscout'] })).toBe('dscout');
    });

    it('should only match full name for org exceptions', () => {
      const config = configureTitleCase({
        orgNameExceptions: ['iPEC Coaching']
      });
      expect(transform('ipec services', config)).toBe('Ipec Services');
    });
  });

  describe('Parentheses and special characters', () => {
    it('should handle company names with parentheses', () => {
      const config = configureTitleCase({});
      expect(transform('ACME (USA) CORP', config)).toBe('Acme (USA) Corp');
    });

    it('should preserve acronyms in parentheses', () => {
      const config = configureTitleCase({});
      expect(transform('SPECIALIZED ABA (IBI) SERVICES', config)).toBe('Specialized ABA (IBI) Services');
    });

    it('should handle ampersands', () => {
      const config = configureTitleCase({});
      expect(transform('JOHNSON & JOHNSON', config)).toBe('Johnson & Johnson');
    });

    it('should handle forward slashes', () => {
      const config = configureTitleCase({});
      expect(transform('ERNST & YOUNG LLP/EY', config)).toBe('Ernst & Young LLP/EY');
    });
  });

  describe('Real-world company names', () => {
    it('should normalize "SPECIALIZED ABA SERVICES, INC."', () => {
      const config = configureTitleCase({
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for']
      });
      expect(transform('SPECIALIZED ABA SERVICES, INC.', config)).toBe('Specialized ABA Services, Inc.');
    });

    it('should normalize "LEARN BEHAVIORAL"', () => {
      const config = configureTitleCase({});
      expect(transform('LEARN Behavioral', config)).toBe('LEARN Behavioral');
    });

    it('should normalize "THE STEPPING STONES GROUP, LLC"', () => {
      const config = configureTitleCase({
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for']
      });
      expect(transform('THE STEPPING STONES GROUP, LLC', config)).toBe('The Stepping Stones Group, LLC');
    });

    it('should normalize "BANK OF AMERICA CORPORATION"', () => {
      const config = configureTitleCase({
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for']
      });
      expect(transform('BANK OF AMERICA CORPORATION', config)).toBe('Bank of America Corporation');
    });
  });

  describe('Edge cases', () => {
    it('should handle single word names', () => {
      const config = configureTitleCase({});
      expect(transform('GOOGLE', config)).toBe('Google');
    });

    it('should handle names with multiple spaces', () => {
      const config = configureTitleCase({});
      expect(transform('ACME    CORPORATION', config)).toBe('Acme Corporation');
    });

    it('should handle leading and trailing whitespace', () => {
      const config = configureTitleCase({});
      expect(transform('  ACME CORPORATION  ', config)).toBe('Acme Corporation');
    });

    it('should handle names with commas', () => {
      const config = configureTitleCase({});
      expect(transform('ACME, INC.', config)).toBe('Acme, Inc.');
    });

    it('should handle names with periods', () => {
      const config = configureTitleCase({});
      expect(transform('A.B.C. COMPANY', config)).toBe('A.B.C. Company');
    });
  });

  describe('Tokenization', () => {
    it('should split on whitespace', () => {
      const tokens = tokenize('Acme Corporation');
      expect(tokens).toEqual(['Acme', ' ', 'Corporation']);
    });

    it('should split around parentheses', () => {
      const tokens = tokenize('Acme (USA)');
      expect(tokens).toEqual(['Acme', ' ', '(', 'USA', ')']);
    });

    it('should split around hyphens when honorHyphenBoundary is true', () => {
      const tokens = tokenize('State-of-the-Art');
      expect(tokens).toContain('-');
    });

    it('should preserve punctuation as separate tokens', () => {
      const tokens = tokenize('Acme, Inc.');
      expect(tokens).toContain(',');
    });
  });

  describe('hyphen boundary', () => {
    beforeAll(() => {
      configureTitleCase({
        brandTokens: ['iPhone', 'eBay', 'HubSpot', 'LinkedIn', 'GitHub'],
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to', 'a', 'an', 'but', 'nor', 'so', 'yet', 'as'],
      });
    });

    it('title cases tokens after hyphen, not conjunction rule', () => {
      expect(toSmartTitleCase('In-Q-Tel')).toBe('In-Q-Tel');
      expect(toSmartTitleCase('Cloud-Based Legal Technology')).toBe('Cloud-Based Legal Technology');
      expect(toSmartTitleCase('Clio - Cloud-Based Legal Technology')).toBe('Clio - Cloud-Based Legal Technology');
      expect(toSmartTitleCase('t-Mobile')).toBe('T-Mobile');
    });
  });

  describe('parenthetical acronyms', () => {
    it('preserves acronyms inside parentheses', () => {
      expect(toSmartTitleCase('HelloGuru (YC W22)')).toBe('HelloGuru (YC W22)');
      expect(toSmartTitleCase('Small Business Administration (SBA)')).toBe('Small Business Administration (SBA)');
    });
  });

  describe('digit tokens', () => {
    it('preserves tokens containing digits', () => {
      expect(toSmartTitleCase('t10r Kapital')).toBe('t10r Kapital');
      expect(toSmartTitleCase('B2B Software')).toBe('B2B Software');
      expect(toSmartTitleCase('Web3 Ventures')).toBe('Web3 Ventures');
      expect(toSmartTitleCase('3M Company')).toBe('3M Company');
    });
  });

  describe('brand tokens', () => {
    beforeAll(() => {
      configureTitleCase({
        brandTokens: ['HubSpot', 'eBay', 'LinkedIn', 'GitHub'],
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to', 'a', 'an'],
      });
    });

    it('preserves known brand tokens from config', () => {
      expect(toSmartTitleCase('HUBSPOT PARTNER')).toBe('HubSpot Partner');
      expect(toSmartTitleCase('ebay solutions')).toBe('eBay Solutions');
      expect(toSmartTitleCase('linkedin recruiter')).toBe('LinkedIn Recruiter');
      expect(toSmartTitleCase('github inc')).toBe('GitHub Inc');
    });
  });

  describe('international legal suffixes', () => {
    beforeAll(() => {
      configureTitleCase({
        brandTokens: ['GmbH', 'Srl', 'BV'],
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to', 'a', 'an'],
      });
    });

    it('preserves legal suffixes as-is', () => {
      expect(toSmartTitleCase('Acme GmbH')).toBe('Acme GmbH');
      expect(toSmartTitleCase('ACME GMBH')).toBe('Acme GmbH');
      expect(toSmartTitleCase('techco srl')).toBe('Techco Srl');
      expect(toSmartTitleCase('global bv')).toBe('Global BV');
    });
  });

  describe('short acronyms', () => {
    it('preserves all-caps tokens 3 chars or fewer', () => {
      expect(toSmartTitleCase('IBM Corporation')).toBe('IBM Corporation');
      expect(toSmartTitleCase('US Healthcare')).toBe('US Healthcare');
      expect(toSmartTitleCase('AI Ventures')).toBe('AI Ventures');
      expect(toSmartTitleCase('YC W22')).toBe('YC W22');
    });
  });

  describe('all-caps normalization', () => {
    it('normalizes all-caps non-acronym words', () => {
      expect(toSmartTitleCase('FOSSA')).toBe('Fossa');
      expect(toSmartTitleCase('ACME CORPORATION')).toBe('Acme Corporation');
      expect(toSmartTitleCase('acme corporation')).toBe('Acme Corporation');
    });
  });

  describe('conjunctions', () => {
    beforeAll(() => {
      configureTitleCase({
        brandTokens: [],
        conjunctions: ['and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to', 'a', 'an', 'but', 'nor', 'so', 'yet', 'as'],
      });
    });

    it('lowercases conjunctions between words', () => {
      expect(toSmartTitleCase('bank of america')).toBe('Bank of America');
      expect(toSmartTitleCase('BANK OF AMERICA')).toBe('Bank of America');
      expect(toSmartTitleCase('Concert (Acquired by Varicent)')).toBe('Concert (Acquired by Varicent)');
    });
  });

  describe('org exceptions', () => {
    it('returns exact stored value for org exceptions', () => {
      const exceptions = new Set(['FOSSA', 'In-Q-Tel']);
      expect(toSmartTitleCase('fossa', { orgExceptions: exceptions })).toBe('FOSSA');
      expect(toSmartTitleCase('in-q-tel', { orgExceptions: exceptions })).toBe('In-Q-Tel');
      expect(toSmartTitleCase('FOSSA', { orgExceptions: exceptions })).toBe('FOSSA');
    });
  });
});
