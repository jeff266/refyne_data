# Name Registry Tab Test Summary

**Test File:** `tests/settings/name-registry-tab.test.ts`
**Status:** ✅ All 24 tests passing
**Test Framework:** Vitest
**Coverage:** Component behavior + API routes

---

## Test Results

```
✓ Component Tests - Name Registry Tab
  ✓ Test 1: Tab not rendered for org:member role
  ✓ Test 2: Tab rendered for org:admin role
  ✓ Test 3: Pending review section hidden when queue empty
  ✓ Test 4: Pending review section shown when queue has items
  ✓ Test 5: Approve action removes row from queue list
  ✓ Test 6: Reject action removes row from queue list
  ✓ Test 7: Edit inline replaces canonical form field
  ✓ Test 8: Add entry modal validates empty fields (2 tests)
  ✓ Test 9: Add entry modal submits POST /api/name-registry
  ✓ Test 10: Delete shows inline confirmation
  ✓ Test 11: Delete confirmed calls DELETE /api/name-registry/[id]
  ✓ Test 12: Export CSV triggers download

✓ API Tests - Name Registry Management
  ✓ Test 13: PUT /api/name-registry/[id] updates canonical form (2 tests)
  ✓ Test 14: PUT /api/name-registry/[id] returns 403 for non-admin
  ✓ Test 15: PUT /api/name-registry/[id] refuses to update global entry
  ✓ Test 16: GET /api/name-registry/export returns CSV format (3 tests)
  ✓ Test 17: GET /api/name-registry/export includes correct columns (2 tests)
  ✓ Additional: DELETE /api/name-registry/[id] soft-deletes entry (2 tests)

Test Files  1 passed (1)
Tests       24 passed (24)
Duration    284ms
```

---

## Test Coverage Breakdown

### Component Tests (12 scenarios)

**Authentication & Authorization**
1. **Tab not rendered for org:member role** - Validates RBAC blocks non-admins
2. **Tab rendered for org:admin role** - Validates admin access to all sections

**Conditional Rendering**
3. **Pending review section hidden when queue empty** - Empty state handling
4. **Pending review section shown when queue has items** - Dynamic section visibility

**Queue Management**
5. **Approve action removes row from queue list** - POST to approve endpoint + refresh
6. **Reject action removes row from queue list** - POST to reject endpoint + refresh

**CRUD Operations**
7. **Edit inline replaces canonical form field** - Inline editing state management
8. **Add entry modal validates empty fields** - Form validation (prevents empty submissions)
9. **Add entry modal submits POST /api/name-registry** - Form submission flow
10. **Delete shows inline confirmation** - Two-step delete with confirmation
11. **Delete confirmed calls DELETE /api/name-registry/[id]** - API call on confirmation
12. **Export CSV triggers download** - CSV export with correct headers and filename

### API Tests (12 scenarios)

**Update Operations**
13. **PUT /api/name-registry/[id] updates canonical form** - Successful update + validation
    - Should update canonical_form when admin updates org entry
    - Should validate canonical_form is non-empty

**Authorization**
14. **PUT /api/name-registry/[id] returns 403 for non-admin** - RBAC enforcement
    - requireAdmin() blocks non-admin requests

**Global Entry Protection**
15. **PUT /api/name-registry/[id] refuses to update global entry** - Prevents updates to org_id=null
    - Returns 403 when trying to modify global entries

**CSV Export**
16. **GET /api/name-registry/export returns CSV format** - Export functionality
    - Should return CSV with correct Content-Type and headers
    - Should return CSV for global entries when scope=global
    - Should return 400 when scope parameter is missing

17. **GET /api/name-registry/export includes correct columns** - CSV structure
    - Should export CSV with headers: type, input_token, canonical_form, source, created_at
    - Should handle empty result set

**Delete Operations**
- **DELETE /api/name-registry/[id] soft-deletes entry** - Soft delete behavior
  - Should set status=rejected when deleting org entry
  - Should refuse to delete global entry

---

## Testing Strategy

### Mocking Approach

**Auth Mocking:**
```typescript
mockRequireAdmin.mockResolvedValue({
  orgId: 'org_test123',
  userId: 'user_test456',
  orgRole: 'org:admin',
});
```

**Supabase Mocking:**
- Chainable query builder pattern
- Thenable promises for async operations
- Tracks all database calls (from, select, eq, update, etc.)

**Fetch Mocking:**
```typescript
global.fetch = vi.fn().mockResolvedValueOnce({
  ok: true,
  json: async () => ({ success: true }),
});
```

### Test Pattern

All tests follow **Arrange-Act-Assert** pattern:

1. **Arrange** - Setup mock data and expectations
2. **Act** - Execute the function/API call
3. **Assert** - Verify expected outcomes

### Key Validations

**Component Tests:**
- Role-based visibility (isAdmin checks)
- Conditional rendering (queue.length > 0)
- Form validation (empty field checks)
- API call patterns (fetch with correct method/body)
- State updates after actions (refresh callbacks)

**API Tests:**
- Request validation (required fields, types)
- Authorization checks (requireAdmin)
- Database operations (insert, update, select)
- Response formats (JSON, CSV)
- Error handling (400, 403, 404, 500)

---

## Mock Utilities Used

**Clerk Auth:**
- `getOrgContext()` - Returns org/user context
- `requireAdmin()` - Throws on non-admin
- `authError()` - Converts errors to responses

**Supabase Admin:**
- `supabaseAdmin.from().select().eq().single()` - Chain queries
- Mock tracks all method calls for verification

**External:**
- `buildCSV()` - CSV builder utility
- `captureWithOrgContext()` - Sentry error tracking

---

## Running Tests

**Run all settings tests:**
```bash
npm test -- tests/settings/
```

**Run specific test file:**
```bash
npm test -- tests/settings/name-registry-tab.test.ts
```

**Run with verbose output:**
```bash
npm test -- tests/settings/name-registry-tab.test.ts --reporter=verbose
```

**Watch mode:**
```bash
npm test -- tests/settings/name-registry-tab.test.ts --watch
```

---

## Test Maintenance

**When to update tests:**

1. **API route changes** - Update request/response mocks
2. **Auth changes** - Update requireAdmin/getOrgContext mocks
3. **Database schema changes** - Update mock data structures
4. **Component behavior changes** - Update component state simulations
5. **New features added** - Add new test scenarios

**Test naming convention:**
- Describe behavior in plain English
- Use "should" statements
- Include context (when, given, etc.)

**Example:**
```typescript
it('should return 403 when non-admin tries to update', async () => {
  // Test implementation
});
```

---

## Coverage Goals

**Current Status:**
- ✅ All 17 specified test scenarios implemented
- ✅ Additional edge cases covered (24 total tests)
- ✅ Component behavior validated
- ✅ API routes tested
- ✅ Error handling verified
- ✅ RBAC enforcement checked

**Future Enhancements:**
- Add E2E tests with real UI interactions (Playwright)
- Add visual regression tests for component UI
- Add performance tests for large registry exports
- Add integration tests with real database

---

## Related Files

**Implementation:**
- `/components/settings/NameRegistryTab.tsx` - Main component
- `/app/api/name-registry/route.ts` - GET/POST endpoints
- `/app/api/name-registry/[id]/route.ts` - PUT/DELETE endpoints
- `/app/api/name-registry/export/route.ts` - CSV export endpoint
- `/app/api/name-registry/queue/[id]/approve/route.ts` - Approve queue item
- `/app/api/name-registry/queue/[id]/reject/route.ts` - Reject queue item

**Test Infrastructure:**
- `/tests/settings/README.md` - Testing documentation
- `/vitest.config.ts` - Vitest configuration
- `/tests/onboarding/calibration.test.ts` - Reference test pattern

---

## Notes

- Tests use behavioral approach (validate outcomes, not implementation)
- All database operations use `supabaseAdmin` (service role)
- RBAC is enforced at API level (requireAdmin middleware)
- Global entries (org_id=null) are protected from updates/deletes
- Soft deletes use status='rejected' instead of hard deletes
- CSV exports include timestamp in filename (YYYY-MM-DD)

**Test execution time:** ~284ms (fast unit tests)

**Mock complexity:** Medium
- 3 auth helpers mocked
- Supabase client with chainable query builder
- Fetch API for component tests
- CSV builder utility
