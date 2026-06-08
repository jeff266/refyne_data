# Phone Format Migration Guide

## For Existing Users

If you're currently using phone normalization, your existing settings are preserved. No action is required.

## Choosing a New Format

### When to use `e164_formatted` (Recommended for US teams)
✅ You're a US-based company with mostly domestic numbers
✅ You want human-readable phone numbers
✅ Your sales team prefers traditional formatting
❌ Example: `+1 (310) 387-9598`

### When to use `e164_dashes` (Common in European exports)
✅ You export data to European CRM systems
✅ Your CSV imports require dash separators
✅ You integrate with European telephony providers
❌ Example: `+1 310-387-9598`

### When to use `e164_spaces` (ITU-T recommended)
✅ You want to follow international standards
✅ Your team operates globally
✅ You need maximum compatibility with international systems
❌ Example: `+1 310 387 9598`

### When to use `e164_compact` (Best for dialers and APIs)
✅ You use sales dialers (Aircall, Gong, etc.)
✅ You integrate with click-to-dial systems
✅ You need machine-readable format
❌ Example: `+13103879598`

### When to use `national` (Legacy US format)
✅ You only have US customers
✅ You never deal with international numbers
✅ Your legacy systems require national format
⚠️ Warning: No country code means ambiguity for international data
❌ Example: `(310) 387-9598`

## Changing Your Format

### Via Calibration Wizard
1. Go to Settings → General
2. Click "Recalibrate normalization settings"
3. Navigate to "Phone" screen
4. Select your preferred format
5. Click "Apply these settings"

### Via New Harmony
1. Go to Normalize → Harmonies
2. Click "+ New Harmony"
3. Choose "Format function"
4. Select "E.164 Phone" as the format function
5. Choose your preferred format from the radio buttons
6. Complete the wizard

## Testing Your Format

Before applying to all records:

1. Create a test harmony targeting a small segment:
   - Add condition: "Company name contains 'TEST'"
   - Apply to 5-10 test records only

2. Review the preview:
   - Check US numbers: `(310) 387-9598` → `+1 310-387-9598` (dashes)
   - Check international: `+44 20 7010 2000` → `+44 20-7010-2000` (dashes)
   - Verify vanity numbers work: `1-800-FLOWERS` → `+1 800-356-9377`
   - Confirm shortcodes skipped: `911` → no change

3. Apply and verify in HubSpot:
   - Click "Apply" in preview
   - Wait for processing to complete
   - Check HubSpot records for correct formatting

## Defensive Checks (All Formats)

All formats include three safety checks:

### 1. Vanity Number Translation
**Before**: `1-800-FLOWERS`
**After**: `+1 800-356-9377` (or your selected format)

### 2. Shortcode Detection
**Input**: `911`, `411`, `12345` (< 7 digits)
**Output**: No change (skipped)

### 3. E.164 Length Validation
**Input**: `+1234567890123456` (16 digits, exceeds E.164 max of 15)
**Output**: No change (skipped)

## International Number Handling

All formats preserve existing country codes:

```
Input:  +44 20 7010 2000 (UK)
Output: +44 20-7010-2000 (dashes format)

Input:  +61 2 9374 4000 (Australia)
Output: +61 2-9374-4000 (dashes format)

Input:  +966 11 123 4567 (Saudi Arabia)
Output: +966 11-123-4567 (dashes format)
```

If no country code is present, the **default country code** (configured in wizard) is applied:

```
Input:  (310) 387-9598
Default: United States (+1)
Output: +1 310-387-9598 (dashes format)
```

## Common Issues

### Issue: International numbers not formatting correctly
**Cause**: Number missing country code
**Solution**: Add country code to input data OR set appropriate default country

### Issue: Extensions being removed
**Cause**: `strip_extensions` enabled (default)
**Solution**: This is intentional - extensions are removed before E.164 formatting

### Issue: Shortcodes being skipped
**Cause**: Number has fewer than 7 digits
**Solution**: This is intentional - shortcodes cannot be normalized to E.164

## Rollback

If you need to revert to a previous format:

1. Go to Normalize → Harmonies
2. Find your phone harmony
3. Click "Edit"
4. Change format in transform_config
5. Save changes
6. Re-run normalization on affected records

## Support

For questions or issues:
- Check test coverage: 1,230 tests passing
- See implementation details: `PHONE_FORMATS_IMPLEMENTATION.md`
- Review UI spec: `PHONE_FORMAT_UI_SPEC.md`

## Implementation Date
June 7, 2026
