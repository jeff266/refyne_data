# Job Segmentation - Configurable Field Mapping

## Overview

The job segmentation system supports configurable output field mapping, allowing you to specify which HubSpot contact properties should receive the classified job level and function data.

## Default Behavior

By default, job segmentation writes to:
- `refyne_job_level` - Job level (C-Suite, VP, Director, Manager, IC, Founder, Other)
- `refyne_job_function` - Job function (Clinical/Healthcare, Revenue Operations, Sales, etc.)

## Custom Field Mapping

You can override the default fields by specifying custom HubSpot property names when starting a job segmentation run.

### API Usage

**POST /api/jobs/segment/run**

```json
{
  "dryRun": false,
  "batchSize": 100,
  "levelField": "job_seniority",      // Custom field for job level
  "functionField": "job_department"   // Custom field for job function
}
```

**Parameters:**
- `levelField` (optional, default: `refyne_job_level`) - HubSpot contact property name for job level
- `functionField` (optional, default: `refyne_job_function`) - HubSpot contact property name for job function
- `dryRun` (optional, default: `false`) - If true, classifies but does not write to HubSpot
- `batchSize` (optional, default: `100`) - Number of contacts to process per batch

### Database Schema

The `job_segmentation_runs` table tracks the field mapping for each run:

```sql
CREATE TABLE job_segmentation_runs (
  id UUID PRIMARY KEY,
  org_id TEXT NOT NULL,
  portal_id TEXT NOT NULL,
  level_field TEXT NOT NULL DEFAULT 'refyne_job_level',
  function_field TEXT NOT NULL DEFAULT 'refyne_job_function',
  -- ... other fields
);
```

## Use Cases

### 1. Custom Property Names

If your organization uses different naming conventions:

```json
{
  "levelField": "contact_seniority",
  "functionField": "contact_department"
}
```

### 2. Testing Without Affecting Production Fields

Test with temporary fields before writing to production:

```json
{
  "levelField": "test_job_level",
  "functionField": "test_job_function",
  "dryRun": false
}
```

### 3. Multiple Segmentation Schemes

Run different segmentation logic to different fields:

```json
// Run 1: Standard segmentation
{
  "levelField": "refyne_job_level",
  "functionField": "refyne_job_function"
}

// Run 2: Custom segmentation
{
  "levelField": "custom_seniority",
  "functionField": "custom_role"
}
```

## Important Notes

### Property Creation

- **Default fields** (`refyne_job_level`, `refyne_job_function`): Automatically created by the system if they don't exist
- **Custom fields**: Must exist in HubSpot before running with `dryRun: false`

### Dry Run Mode

When testing custom field mappings, always start with `dryRun: true`:

```json
{
  "levelField": "my_custom_field",
  "functionField": "my_custom_function",
  "dryRun": true  // Test first!
}
```

This will:
1. Fetch contacts
2. Classify job titles
3. Log what would be written
4. **Not** attempt to write to HubSpot

### Field Validation

The system does not validate that custom fields exist in HubSpot. If you specify fields that don't exist and run with `dryRun: false`, the writes will fail and errors will be logged to the run record.

## Testing

Test custom field mapping with the included test script:

```bash
npm run jobs:custom-fields
```

This runs a dry-run test using custom fields (`job_seniority`, `job_department`) to verify the mapping works correctly.

## Example: Full Workflow

```bash
# 1. Test with dry run
curl -X POST https://your-app.com/api/jobs/segment/run \
  -H "Content-Type: application/json" \
  -d '{
    "levelField": "contact_level",
    "functionField": "contact_function",
    "dryRun": true,
    "batchSize": 50
  }'

# 2. Get run ID from response
# {"runId": "abc123...", "status": "pending"}

# 3. Check results
curl https://your-app.com/api/jobs/segment/runs/abc123...

# 4. If dry run looks good, run for real
curl -X POST https://your-app.com/api/jobs/segment/run \
  -H "Content-Type: application/json" \
  -d '{
    "levelField": "contact_level",
    "functionField": "contact_function",
    "dryRun": false
  }'
```

## Migration Guide

If you have existing runs using the default fields and want to migrate to custom fields:

1. Create the new custom properties in HubSpot
2. Run job segmentation with the new fields
3. (Optional) Copy data from old fields to new fields using a HubSpot workflow
4. Update your UI/integrations to use the new field names
5. (Optional) Archive or delete the old `refyne_job_level` and `refyne_job_function` properties
