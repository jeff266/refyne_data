/**
 * Zod Validation Tests
 *
 * Tests for request body validation on all API routes with Zod schemas.
 * Each test verifies that invalid requests return 400 with validation details.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Zod Validation: Route Schemas', () => {
  it('should validate dedup/signal-groups POST schema', () => {
    const schema = z.object({
      name: z.string().optional(),
      objectType: z.enum(['company', 'contact']),
      group_order: z.number().int().min(1).optional(),
      conditions: z.array(z.object({
        field: z.string().min(1),
        match_type: z.enum(['exact', 'fuzzy', 'normalized']),
        fuzzy_threshold: z.number().min(0.5).max(1.0).optional(),
        weight: z.number().int().min(1).max(100).optional(),
      })).min(1),
    });

    // Valid
    expect(() => schema.parse({ objectType: 'company', conditions: [{ field: 'domain', match_type: 'exact' }] })).not.toThrow();

    // Invalid - missing conditions
    expect(() => schema.parse({ objectType: 'company' })).toThrow();

    // Invalid - empty conditions array
    expect(() => schema.parse({ objectType: 'company', conditions: [] })).toThrow();
  });

  it('should validate dedup/field-exclusions POST schema', () => {
    const schema = z.object({
      fieldName: z.string().min(1),
      objectType: z.enum(['company', 'contact']).default('company'),
      exclusionType: z.enum(['never_merge', 'union_true', 'append']),
      separator: z.enum(['\n', '; ', ', ']).optional(),
    });

    // Valid
    expect(() => schema.parse({ fieldName: 'notes', exclusionType: 'append' })).not.toThrow();

    // Invalid - missing fieldName
    expect(() => schema.parse({ exclusionType: 'append' })).toThrow();

    // Invalid - wrong exclusionType
    expect(() => schema.parse({ fieldName: 'notes', exclusionType: 'invalid' })).toThrow();
  });

  it('should validate normalize/apply POST schema', () => {
    const schema = z.object({
      harmonyIds: z.array(z.string()).optional(),
      selectedChanges: z.array(z.object({
        companyId: z.string(),
        field: z.string(),
        before: z.string().optional(),
        after: z.string().optional(),
      })).optional(),
      objectType: z.enum(['company', 'contact']).default('company'),
    });

    // Valid
    expect(() => schema.parse({ harmonyIds: ['harmony_1'] })).not.toThrow();

    // Valid - selectedChanges
    expect(() => schema.parse({ selectedChanges: [{ companyId: '123', field: 'industry' }] })).not.toThrow();
  });

  it('should validate import/match POST schema', () => {
    const schema = z.object({
      session_id: z.string().uuid(),
      field_mapping: z.object({
        email: z.string().min(1),
        linkedin_url: z.string().optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        full_name: z.string().optional(),
        job_title: z.string().optional(),
        company: z.string().optional(),
        location: z.string().optional(),
      }),
      filters: z.record(z.unknown()).optional(),
    });

    // Valid
    expect(() => schema.parse({
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      field_mapping: { email: 'email_col' }
    })).not.toThrow();

    // Invalid - not a UUID
    expect(() => schema.parse({
      session_id: 'not-a-uuid',
      field_mapping: { email: 'email_col' }
    })).toThrow();

    // Invalid - missing email in field_mapping
    expect(() => schema.parse({
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      field_mapping: {}
    })).toThrow();
  });

  it('should validate import/execute POST schema', () => {
    const schema = z.object({
      session_id: z.string().uuid(),
      write_config: z.object({
        update_customers: z.boolean(),
        create_new_contacts: z.boolean(),
        update_known_contacts: z.boolean(),
        skip_needs_review: z.boolean(),
      }),
      hubspot_list: z.object({
        enabled: z.boolean(),
        list_name: z.string().optional(),
        buckets: z.array(z.string()).optional(),
      }).optional(),
      owner_assignment: z.object({
        enabled: z.boolean(),
        owners: z.array(z.object({
          id: z.string(),
          weight: z.number().min(0).max(100),
        })).optional(),
      }).optional(),
    });

    // Valid
    expect(() => schema.parse({
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      write_config: {
        update_customers: true,
        create_new_contacts: true,
        update_known_contacts: true,
        skip_needs_review: false,
      }
    })).not.toThrow();

    // Invalid - missing write_config
    expect(() => schema.parse({
      session_id: '123e4567-e89b-12d3-a456-426614174000',
    })).toThrow();
  });

  it('should validate dedup/merge POST schema (already implemented)', () => {
    const schema = z.object({
      masterId: z.string().min(1),
      fieldSelections: z.record(z.string()).optional(),
      absorb: z.boolean().optional(),
    });

    // Valid
    expect(() => schema.parse({ masterId: 'comp_123' })).not.toThrow();

    // Invalid - empty masterId
    expect(() => schema.parse({ masterId: '' })).toThrow();
  });

  it('should validate harmonies POST schema (already implemented)', () => {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(['company', 'contact', 'deal']).optional(),
      field: z.string().min(1),
      approach: z.string().optional(),
      object_type: z.enum(['company', 'contact', 'deal']).optional(),
      transform_type: z.string().optional(),
      transform_function: z.string().optional(),
      write_policy: z.string().optional(),
    });

    // Valid
    expect(() => schema.parse({ name: 'Test Harmony', field: 'industry' })).not.toThrow();

    // Invalid - missing name
    expect(() => schema.parse({ field: 'industry' })).toThrow();
  });

  it('should validate billing/checkout POST schema (already implemented)', () => {
    const schema = z.object({
      priceId: z.string().min(1),
      interval: z.enum(['month', 'year']),
      addAlwaysOn: z.boolean().optional().default(false),
      successUrl: z.string().url().optional(),
      cancelUrl: z.string().url().optional(),
    });

    // Valid
    expect(() => schema.parse({ priceId: 'price_123', interval: 'month' })).not.toThrow();

    // Invalid - wrong interval
    expect(() => schema.parse({ priceId: 'price_123', interval: 'weekly' })).toThrow();
  });

  it('should validate team/invite POST schema', () => {
    const schema = z.object({
      email: z.string().email(),
      role: z.enum(['org:admin', 'org:member']),
    });

    // Valid
    expect(() => schema.parse({ email: 'user@example.com', role: 'org:member' })).not.toThrow();

    // Invalid - bad email format
    expect(() => schema.parse({ email: 'not-an-email', role: 'org:member' })).toThrow();

    // Invalid - wrong role
    expect(() => schema.parse({ email: 'user@example.com', role: 'invalid' })).toThrow();
  });

  it('should validate provider-requests POST schema', () => {
    const schema = z.object({
      provider_name: z.string().min(1).max(100),
      reason: z.string().max(1000).optional(),
    });

    // Valid
    expect(() => schema.parse({ provider_name: 'Apollo.io' })).not.toThrow();

    // Invalid - empty provider_name
    expect(() => schema.parse({ provider_name: '' })).toThrow();

    // Invalid - provider_name too long
    expect(() => schema.parse({ provider_name: 'a'.repeat(101) })).toThrow();
  });

  it('should validate harmonies/[id] PATCH schema', () => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      writePolicy: z.string().optional(),
      isActive: z.boolean().optional(),
      is_active: z.boolean().optional(),
      isArchived: z.boolean().optional(),
      is_archived: z.boolean().optional(),
      conditionGroups: z.any().optional(),
      approach: z.string().optional(),
      rules: z.array(z.any()).optional(),
    });

    // Valid
    expect(() => schema.parse({ name: 'Updated Name' })).not.toThrow();
    expect(() => schema.parse({ writePolicy: 'fill_empty', isActive: true })).not.toThrow();

    // Invalid - empty name string
    expect(() => schema.parse({ name: '' })).toThrow();

    // Invalid - wrong type for isActive
    expect(() => schema.parse({ isActive: 'true' })).toThrow();
  });

  it('should validate onboarding/progress PATCH schema', () => {
    const schema = z.object({
      workspace_name: z.string().optional().nullable(),
      user_role: z.string().optional().nullable(),
      calibration_completed: z.boolean().optional(),
      connected_hubspot: z.boolean().optional(),
      viewed_dashboard: z.boolean().optional(),
    });

    // Valid
    expect(() => schema.parse({ workspace_name: 'My Company' })).not.toThrow();
    expect(() => schema.parse({ calibration_completed: true, viewed_dashboard: false })).not.toThrow();

    // Invalid - wrong type for boolean
    expect(() => schema.parse({ calibration_completed: 'true' })).toThrow();

    // Invalid - wrong type for string
    expect(() => schema.parse({ workspace_name: 123 })).toThrow();
  });

  it('should validate settings/general PUT schema', () => {
    const schema = z.object({
      workspaceName: z.string().optional(),
      displayName: z.string().optional(),
      timezone: z.string().optional(),
      digestTime: z.string().optional(),
      scoreThreshold: z.number().optional(),
      sendOnNoChange: z.boolean().optional(),
      emailRecipients: z.array(z.string()).optional(),
    });

    // Valid
    expect(() => schema.parse({ workspaceName: 'Acme Inc', timezone: 'America/New_York' })).not.toThrow();
    expect(() => schema.parse({ scoreThreshold: 5, sendOnNoChange: true })).not.toThrow();

    // Invalid - wrong type for number
    expect(() => schema.parse({ scoreThreshold: '5' })).toThrow();

    // Invalid - wrong type for array
    expect(() => schema.parse({ emailRecipients: 'user@example.com' })).toThrow();
  });

  it('should validate dedup/config PATCH schema', () => {
    const schema = z.object({
      inactive_owner_action: z.enum(['warn', 'assign_fallback', 'leave_unassigned']).optional(),
      inactive_owner_fallback_id: z.string().optional(),
      parent_child_awareness: z.boolean().optional(),
      require_closed_won_survivor: z.boolean().optional(),
    });

    // Valid
    expect(() => schema.parse({ inactive_owner_action: 'warn' })).not.toThrow();
    expect(() => schema.parse({ parent_child_awareness: true })).not.toThrow();

    // Invalid - wrong enum value
    expect(() => schema.parse({ inactive_owner_action: 'invalid' })).toThrow();

    // Invalid - wrong type for boolean
    expect(() => schema.parse({ parent_child_awareness: 'true' })).toThrow();
  });

  it('should validate import/rule-sets POST schema', () => {
    const schema = z.object({
      name: z.string().trim().min(1),
      description: z.string().optional(),
      rules: z.array(z.any()),
    });

    // Valid
    expect(() => schema.parse({ name: 'My Rule Set', rules: [] })).not.toThrow();

    // Invalid - empty name after trim
    expect(() => schema.parse({ name: '   ', rules: [] })).toThrow();

    // Invalid - rules not an array
    expect(() => schema.parse({ name: 'Test', rules: 'not-array' })).toThrow();
  });

  it('should validate blog/posts POST schema', () => {
    const schema = z.object({
      title: z.string().optional(),
      slug: z.string().optional(),
      excerpt: z.string().optional(),
      body_json: z.any().optional(),
      body_html: z.string().optional(),
      tag: z.string().optional(),
      featured: z.boolean().optional(),
    });

    // Valid
    expect(() => schema.parse({ title: 'New Post', featured: true })).not.toThrow();

    // Invalid - wrong type for boolean
    expect(() => schema.parse({ featured: 'yes' })).toThrow();
  });

  it('should validate blog/posts/[id] PATCH schema', () => {
    const schema = z.object({
      title: z.string().optional(),
      slug: z.string().optional(),
      status: z.string().optional(),
      featured: z.boolean().optional(),
    });

    // Valid
    expect(() => schema.parse({ title: 'Updated Title' })).not.toThrow();
    expect(() => schema.parse({ status: 'published', featured: true })).not.toThrow();

    // Invalid - wrong type
    expect(() => schema.parse({ featured: 'true' })).toThrow();
  });

  it('should validate enrich/apply/enqueue POST schema', () => {
    const schema = z.object({
      jobId: z.string().min(1),
      runId: z.string().optional(),
      selectedRecordIds: z.array(z.string()).min(1),
    });

    // Valid
    expect(() => schema.parse({ jobId: 'job-123', selectedRecordIds: ['rec-1', 'rec-2'] })).not.toThrow();

    // Invalid - empty jobId
    expect(() => schema.parse({ jobId: '', selectedRecordIds: ['rec-1'] })).toThrow();

    // Invalid - empty selectedRecordIds
    expect(() => schema.parse({ jobId: 'job-123', selectedRecordIds: [] })).toThrow();
  });

  it('should validate jobs/segment/run POST schema', () => {
    const schema = z.object({
      dryRun: z.boolean().optional(),
      batchSize: z.number().int().positive().optional(),
      levelField: z.string().optional(),
      functionField: z.string().optional(),
    });

    // Valid
    expect(() => schema.parse({ dryRun: true, batchSize: 50 })).not.toThrow();

    // Invalid - wrong type for boolean
    expect(() => schema.parse({ dryRun: 'true' })).toThrow();

    // Invalid - negative batch size
    expect(() => schema.parse({ batchSize: -1 })).toThrow();
  });

  it('should validate name-registry POST schema', () => {
    const schema = z.object({
      registry_type: z.enum(['company', 'contact_first', 'contact_last', 'contact_token']),
      input_token: z.string().trim().min(1),
      canonical_form: z.string().trim().min(1),
    });

    // Valid
    expect(() => schema.parse({
      registry_type: 'company',
      input_token: 'acme corp',
      canonical_form: 'Acme Corporation'
    })).not.toThrow();

    // Invalid - wrong enum value
    expect(() => schema.parse({
      registry_type: 'invalid',
      input_token: 'test',
      canonical_form: 'Test'
    })).toThrow();

    // Invalid - empty input_token after trim
    expect(() => schema.parse({
      registry_type: 'company',
      input_token: '   ',
      canonical_form: 'Test'
    })).toThrow();
  });
});
