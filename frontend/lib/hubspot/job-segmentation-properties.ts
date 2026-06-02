/**
 * HubSpot Job Segmentation Custom Properties
 *
 * Creates and manages custom contact properties for job level and function.
 * These properties store the AI-classified job segmentation data.
 */

import { HubSpotClient } from './client';

export const JOB_LEVEL_PROPERTY = 'refyne_job_level';
export const JOB_FUNCTION_PROPERTY = 'refyne_job_function';

const JOB_LEVELS = ['C-Suite', 'VP', 'Director', 'Manager', 'IC', 'Founder', 'Other'];
const JOB_FUNCTIONS = [
  'Clinical/Healthcare',
  'Revenue Operations',
  'Sales',
  'Marketing',
  'Finance',
  'Engineering',
  'Operations',
  'Executive',
  'People/HR',
  'Other',
];

export async function ensureJobSegmentationProperties(
  client: HubSpotClient
): Promise<void> {
  // Create refyne_job_level if it doesn't exist
  await client.ensureContactProperty({
    name: JOB_LEVEL_PROPERTY,
    label: 'Job Level (Refyne)',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'contactinformation',
    options: JOB_LEVELS.map((level) => ({
      label: level,
      value: level,
      displayOrder: JOB_LEVELS.indexOf(level),
      hidden: false,
    })),
  });

  // Create refyne_job_function if it doesn't exist
  await client.ensureContactProperty({
    name: JOB_FUNCTION_PROPERTY,
    label: 'Job Function (Refyne)',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'contactinformation',
    options: JOB_FUNCTIONS.map((fn) => ({
      label: fn,
      value: fn,
      displayOrder: JOB_FUNCTIONS.indexOf(fn),
      hidden: false,
    })),
  });
}
