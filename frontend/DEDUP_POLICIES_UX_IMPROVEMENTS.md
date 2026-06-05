# Dedup Policies Page - UX Improvements Investigation & Plan

## Current Issues

### 1. Object Switcher Support
**Status:** ❌ NOT IMPLEMENTED
- URL shows `?object=contact` but the page doesn't read this parameter
- Field rules are global (not per-object-type) but the field selector should show fields for the active object type
- Users expect the field dropdown to show contact fields when on contacts, company fields when on companies

**Fix:** Add `useSearchParams` to read `objectType` and fetch appropriate field options

---

### 2. Field Input is Type-In (Should be Dropdown)
**Status:** ❌ BAD UX
- Users must manually type field names like "lifecyclestage"
- High error rate: typos, wrong field names, not knowing field exists
- No discovery: users can't browse available fields

**Current Code:**
```tsx
<input
  type="text"
  value={rule.field}
  onChange={(e) => updateFieldRule(index, { field: e.target.value })}
  placeholder="lifecyclestage"
/>
```

**Proposed Fix:**
- Replace with searchable dropdown/combobox
- Fetch HubSpot properties from `/api/hubspot/properties?objectType={objectType}`
- Sort order:
  1. Wildcard "*" at top
  2. Popular fields: domain, name, email, phone, industry, lifecyclestage
  3. Rest alphabetically
- Show field label + API name (like "Lifecycle Stage" with "lifecyclestage" in gray)

---

### 3. Rule Types Don't Filter by Field Type
**Status:** ❌ NOT VALIDATED
- All 8 rule types show for every field
- Some rules only make sense for specific field types:
  - `keep_most_advanced` → only enum fields
  - `keep_highest/keep_lowest` → only number fields
  - `append_both` → only text/string fields

**Current Rule Types:**
```typescript
const RULE_TYPES = [
  { value: 'fill_empty', label: 'Fill empty' },        // All types
  { value: 'keep_master', label: 'Keep master' },      // All types
  { value: 'append_both', label: 'Append both' },      // Text only
  { value: 'keep_highest', label: 'Keep highest' },    // Number only
  { value: 'keep_lowest', label: 'Keep lowest' },      // Number only
  { value: 'keep_newest', label: 'Keep newest' },      // All types
  { value: 'keep_oldest', label: 'Keep oldest' },      // All types
  { value: 'keep_most_advanced', label: 'Keep most advanced' }, // Enum only
];
```

**Proposed Fix:**
- Store field type when field is selected
- Filter `RULE_TYPES` based on field type:
  ```typescript
  function getApplicableRules(fieldType: string) {
    const allRules = ['fill_empty', 'keep_master', 'keep_newest', 'keep_oldest'];

    if (fieldType === 'string' || fieldType === 'text') {
      return [...allRules, 'append_both'];
    }
    if (fieldType === 'number') {
      return [...allRules, 'keep_highest', 'keep_lowest'];
    }
    if (fieldType === 'enumeration' || fieldType === 'booleancheckbox') {
      return [...allRules, 'keep_most_advanced'];
    }
    return allRules;
  }
  ```

---

### 4. Funnel Order is Type-In (Should Fetch Enum Values)
**Status:** ❌ VERY BAD UX
- When using `keep_most_advanced` rule, user must manually type: "lead, marketingqualifiedlead, salesqualifiedlead, opportunity, customer"
- What if user doesn't know the exact values?
- What if user misspells? "salesqualifedlead" vs "salesqualifiedlead"
- What if HubSpot has different values than expected?

**Current Code:**
```tsx
<input
  type="text"
  value={rule.config.order?.join(', ') || ''}
  placeholder="lead, marketingqualifiedlead, salesqualifiedlead, opportunity, customer"
/>
```

**Proposed Fix:**
- When field is selected AND rule is `keep_most_advanced`
- Fetch enum values from `/api/hubspot/properties/{fieldKey}/options?objectType={objectType}`
- Show drag-and-drop OrderEditor (same component used in survivorship rules)
- Let user reorder by dragging
- Auto-populate `config.order` with the selected order

**Reference:** This pattern already exists in `AddRuleModal.tsx` (survivorship rules):
```tsx
// SpecificValueConfig component fetches and shows draggable options
useEffect(() => {
  fetch(`/api/hubspot/properties/${fieldKey}/options`)
    .then(r => r.json())
    .then(data => setOptions(data.options));
}, [fieldKey]);
```

---

## Implementation Plan

### Phase 1: Object Type Support (20 min)
1. Import `useSearchParams` from 'next/navigation'
2. Read `objectType` with default to 'company'
3. Fetch field options on mount and when objectType changes
4. Store in `fieldOptions` state

### Phase 2: Field Dropdown (45 min)
1. Create `FieldPicker` component (similar to HubSpotPropertyPicker)
2. Fetch fields from `/api/hubspot/properties?objectType={objectType}`
3. Add "*" wildcard at top
4. Sort: popular fields first, then alphabetical
5. Show label + API name
6. Replace text input with FieldPicker

### Phase 3: Rule Type Filtering (30 min)
1. Store field type when field is selected
2. Create `getApplicableRules(fieldType)` function
3. Filter RULE_TYPES dropdown based on field type
4. Update rule validation

### Phase 4: Enum Value Picker (60 min)
1. Detect when field is enum AND rule is keep_most_advanced
2. Fetch enum values from `/api/hubspot/properties/{field}/options`
3. Replace text input with OrderEditor component
4. Allow drag-to-reorder
5. Store order in config.order as array

---

## Files to Modify

1. **app/(dashboard)/settings/policies/dedup/page.tsx**
   - Add useSearchParams
   - Add fieldOptions state and fetch logic
   - Replace field text input with dropdown
   - Add field type tracking
   - Filter rule types by field type
   - Add enum value picker for keep_most_advanced

2. **Potentially create new component:**
   - `components/dedup/FieldPicker.tsx` (if needed)

---

## Testing Checklist

- [ ] Object switcher changes field options
- [ ] Field dropdown shows popular fields first
- [ ] Field dropdown shows correct fields for company vs contact
- [ ] Wildcard "*" appears at top of field list
- [ ] Rule types filtered by field type (number → keep_highest/keep_lowest, enum → keep_most_advanced, etc.)
- [ ] Enum fields with keep_most_advanced show drag-and-drop editor
- [ ] Enum values fetched correctly from HubSpot
- [ ] Order saved correctly as array in config
- [ ] Existing policies still load correctly
- [ ] Validation prevents invalid field/rule combinations

---

## Risk Assessment

**Low Risk:**
- Phase 1 (object type) - just reading URL param
- Phase 3 (rule filtering) - just filtering dropdown

**Medium Risk:**
- Phase 2 (field dropdown) - UI change but doesn't affect data model
- Phase 4 (enum picker) - changes how config is stored, but backend should handle both formats

**Migration Needed?**
- No - existing text-based configs will continue to work
- New configs will have better UX but same data format
