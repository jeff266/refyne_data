# Phone Format UI Specification

## Radio Button List (Both Wizards)

The phone format selection appears in both:
1. Calibration Wizard (Screen 1: Phone) - `/onboarding/calibrate`
2. New Harmony Wizard (E.164 Phone sub-options) - Harmony creation flow

### Visual Layout

```
○ +1 (310) 387-9598               [Recommended]
  International with formatting
  Recommended for US teams

○ +1 310-387-9598
  International with dashes
  Common in European exports

○ +1 310 387 9598
  International with spaces
  ITU-T recommended spacing

○ +13103879598
  E.164 compact
  Best for dialers and APIs

○ (310) 387-9598
  National, no country code
  Legacy US format
```

### Component Structure

Each option uses the `<OptionCard>` component with:
- **title**: The formatted phone number example
- **description**: Format name
- **example**: Use case/recommendation
- **badge**: Optional "Recommended" badge (first option only)

### Default Selection

The default format is `e164_formatted` (first option) to maintain backward compatibility.

## Country Code Dropdown

Below the format options, a country code selector appears:

```
Primary country
[United States (+1)  ▼]

Numbers already containing a country code (+44, +966, etc.) are
preserved as-is. For numbers without a country code prefix, the
default above is applied. If your data contains numbers from
multiple countries without prefixes, consider normalizing them
in HubSpot before importing.
```

Uses `<SearchableCountrySelect>` component with:
- Searchable dropdown
- Country name + code display
- Default: United States (+1)

## Harmony Wizard Specific

In the Harmony Wizard (`components/harmonies/HarmonyWizard.tsx`), the phone config panel appears when `formatFunction === 'e164_phone'`.

Additional elements:
- **Format options section** (same 5 radio buttons)
- **Country code selector** (same dropdown)
- **Info note** about international number handling (blue info box)

### Info Box Text

```
ℹ  Numbers already containing a country code (+44, +966, etc.)
   are preserved as-is. For numbers without a country code
   prefix, the default above is applied. If your data contains
   numbers from multiple countries without prefixes, consider
   normalizing them in HubSpot before importing.
```

## Summary Screen (Calibration Wizard)

When reviewing settings on the final screen:

```
Phone: +1 310-387-9598 (International with dashes)
```

Format display logic:
- e164_formatted: "+1 (310) 387-9598 (International with formatting)"
- e164_dashes: "+1 310-387-9598 (International with dashes)"
- e164_spaces: "+1 310 387 9598 (International with spaces)"
- e164_compact: "+13103879598 (E.164 compact)"
- national: "(310) 387-9598 (National)"

## Preview Table (Calibration Wizard)

The live preview table shows before/after examples:

```
Field   Before               After
Phone   562-735-0870         +1 310-387-9598
```

The "After" column updates dynamically based on selected format.

## Design System

All UI elements follow the Refyne design system:

### Colors
- Selected card: `C.indigoDim` background, `C.indigoBrd` border
- Unselected card: `C.surface` background, `C.border2` border
- Badge: `C.indigo` text, `C.indigoDim` background
- Info note: `C.blueDim` background, `C.blueBrd` border

### Typography
- Title: 12px, medium weight, monospace (phone numbers)
- Description: 11px, regular weight
- Example: 10px, light color
- Badge: 10px, 600 weight, uppercase

### Spacing
- Card padding: 12px vertical, 16px horizontal
- Card margin: 12px bottom
- Gap between radio and text: 8px
- Info note padding: 12px

### Corners
- **Square corners everywhere**: `borderRadius: 0` (design system requirement)
- Exception: Radio buttons use circular `borderRadius: '50%'`

## Accessibility

- Radio buttons are properly grouped with `name="phone-format"`
- Click targets include entire card area
- Keyboard navigation supported
- Visual feedback on hover/focus
- Clear selected state with border + background color
