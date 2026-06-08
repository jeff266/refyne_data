/**
 * Client Job Classifier Tests
 *
 * Tests for client-side job title classification (no API calls)
 */

import { describe, it, expect } from 'vitest';
import { classifyJobTitleLevel, countByJobLevel } from '@/lib/import/client-job-classifier';

describe('classifyJobTitleLevel', () => {
  describe('C-Suite', () => {
    it('should classify CEO', () => {
      expect(classifyJobTitleLevel('Chief Executive Officer')).toBe('C-Suite');
      expect(classifyJobTitleLevel('CEO')).toBe('C-Suite');
    });

    it('should classify CFO', () => {
      expect(classifyJobTitleLevel('Chief Financial Officer')).toBe('C-Suite');
      expect(classifyJobTitleLevel('CFO')).toBe('C-Suite');
    });

    it('should classify CTO', () => {
      expect(classifyJobTitleLevel('Chief Technology Officer')).toBe('C-Suite');
      expect(classifyJobTitleLevel('CTO')).toBe('C-Suite');
    });

    it('should classify Chief Clinical Officer', () => {
      expect(classifyJobTitleLevel('Chief Clinical Officer')).toBe('C-Suite');
    });
  });

  describe('Founder', () => {
    it('should classify Founder', () => {
      expect(classifyJobTitleLevel('Founder')).toBe('Founder');
      expect(classifyJobTitleLevel('Co-Founder')).toBe('Founder');
    });

    it('should classify Owner', () => {
      expect(classifyJobTitleLevel('Owner')).toBe('Founder');
    });

    it('should classify President (not Vice President)', () => {
      expect(classifyJobTitleLevel('President')).toBe('Founder');
    });
  });

  describe('EVP / SVP', () => {
    it('should classify Executive Vice President', () => {
      expect(classifyJobTitleLevel('Executive Vice President')).toBe('EVP / SVP');
      expect(classifyJobTitleLevel('EVP')).toBe('EVP / SVP');
    });

    it('should classify Senior Vice President', () => {
      expect(classifyJobTitleLevel('Senior Vice President')).toBe('EVP / SVP');
      expect(classifyJobTitleLevel('SVP')).toBe('EVP / SVP');
    });
  });

  describe('VP', () => {
    it('should classify Vice President', () => {
      expect(classifyJobTitleLevel('Vice President')).toBe('VP');
      expect(classifyJobTitleLevel('VP')).toBe('VP');
      expect(classifyJobTitleLevel('V.P.')).toBe('VP');
    });

    it('should classify VP of Sales', () => {
      expect(classifyJobTitleLevel('Vice President of Sales')).toBe('VP');
    });

    it('should not classify Assistant to the VP as VP', () => {
      expect(classifyJobTitleLevel('Assistant to the VP of Marketing')).toBe('IC');
    });
  });

  describe('Director', () => {
    it('should classify Director', () => {
      expect(classifyJobTitleLevel('Director')).toBe('Director');
      expect(classifyJobTitleLevel('Director of Marketing')).toBe('Director');
    });

    it('should classify Clinical Director', () => {
      expect(classifyJobTitleLevel('Clinical Director')).toBe('Director');
    });

    it('should classify Head of X', () => {
      expect(classifyJobTitleLevel('Head of Sales')).toBe('Director');
    });
  });

  describe('Manager', () => {
    it('should classify Manager', () => {
      expect(classifyJobTitleLevel('Manager')).toBe('Manager');
      expect(classifyJobTitleLevel('Sales Manager')).toBe('Manager');
      expect(classifyJobTitleLevel('Account Manager')).toBe('Manager');
    });

    it('should classify Supervisor', () => {
      expect(classifyJobTitleLevel('Supervisor')).toBe('Manager');
    });

    it('should classify Lead', () => {
      expect(classifyJobTitleLevel('Team Lead')).toBe('Manager');
    });
  });

  describe('IC', () => {
    it('should classify BCBA', () => {
      expect(classifyJobTitleLevel('BCBA')).toBe('IC');
      expect(classifyJobTitleLevel('Board Certified Behavior Analyst')).toBe('IC');
    });

    it('should classify Therapist', () => {
      expect(classifyJobTitleLevel('Therapist')).toBe('IC');
      expect(classifyJobTitleLevel('Behavior Therapist')).toBe('IC');
    });

    it('should classify Account Executive', () => {
      expect(classifyJobTitleLevel('Account Executive')).toBe('IC');
    });

    it('should classify Engineer without leadership keywords', () => {
      expect(classifyJobTitleLevel('Software Engineer')).toBe('IC');
      expect(classifyJobTitleLevel('Senior Software Engineer')).toBe('IC');
    });

    it('should classify Coordinator', () => {
      expect(classifyJobTitleLevel('Marketing Coordinator')).toBe('IC');
    });
  });

  describe('Needs Review', () => {
    it('should flag Member as needs review', () => {
      expect(classifyJobTitleLevel('Member')).toBe('Needs Review');
      expect(classifyJobTitleLevel('Team Member')).toBe('Needs Review');
    });

    it('should flag Expert as needs review', () => {
      expect(classifyJobTitleLevel('Expert')).toBe('Needs Review');
      expect(classifyJobTitleLevel('Subject Matter Expert')).toBe('Needs Review');
    });

    it('should flag Advisor as needs review', () => {
      expect(classifyJobTitleLevel('Advisor')).toBe('Needs Review');
      expect(classifyJobTitleLevel('Board Advisor')).toBe('Needs Review');
    });

    it('should flag Consultant as needs review', () => {
      expect(classifyJobTitleLevel('Consultant')).toBe('Needs Review');
    });

    it('should flag Specialist without seniority as needs review', () => {
      expect(classifyJobTitleLevel('Marketing Specialist')).toBe('Needs Review');
    });

    it('should flag Analyst without seniority as needs review', () => {
      expect(classifyJobTitleLevel('Business Analyst')).toBe('Needs Review');
    });
  });

  describe('Other', () => {
    it('should classify empty titles as Other', () => {
      expect(classifyJobTitleLevel('')).toBe('Other');
      expect(classifyJobTitleLevel(null)).toBe('Other');
      expect(classifyJobTitleLevel(undefined)).toBe('Other');
    });

    it('should classify unrecognized titles as Other', () => {
      expect(classifyJobTitleLevel('Random Job Title XYZ')).toBe('Other');
    });
  });
});

describe('countByJobLevel', () => {
  it('should count contacts by level', () => {
    const titles = [
      'CEO',
      'VP of Sales',
      'Director of Marketing',
      'Sales Manager',
      'Account Executive',
      'Founder',
      'Member',
      '',
    ];

    const counts = countByJobLevel(titles);

    expect(counts['C-Suite']).toBe(1);
    expect(counts['VP']).toBe(1);
    expect(counts['Director']).toBe(1);
    expect(counts['Manager']).toBe(1);
    expect(counts['IC']).toBe(1);
    expect(counts['Founder']).toBe(1);
    expect(counts['Needs Review']).toBe(1);
    expect(counts['Other']).toBe(1);
  });

  it('should handle all null/empty titles', () => {
    const titles = [null, undefined, '', '   '];
    const counts = countByJobLevel(titles);

    expect(counts['Other']).toBe(4);
    expect(counts['C-Suite']).toBe(0);
  });
});
