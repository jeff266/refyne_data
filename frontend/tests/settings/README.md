# Settings Tests

Comprehensive tests for Settings UI components and API routes.

## Test Files

### `name-registry-tab.test.ts`

Tests for Day 4 Settings UI + Registry Management feature.

**Coverage:** 17 test scenarios across component behavior and API functionality

**Component Tests (1-12):**
- Role-based access control (admin vs member visibility)
- Conditional section rendering (pending queue, workspace registry, global registry)
- Queue item actions (approve, reject)
- CRUD operations (add, edit, delete)
- CSV export functionality

**API Tests (13-17):**
- PUT /api/name-registry/[id] - Update canonical form
- DELETE /api/name-registry/[id] - Soft delete entries
- GET /api/name-registry/export - CSV export with correct format and columns
- RBAC enforcement (403 for non-admins)
- Global entry protection (prevent updates/deletes)

**Test Pattern:**
- Follows behavioral testing approach (validates outcomes, not implementation)
- Mocks API calls using Vitest mocking
- Simulates user interactions and component state
- Validates data transformations and side effects

**Run tests:**
```bash
npm test -- tests/settings/name-registry-tab.test.ts
```

## Testing Principles

1. **Behavioral over implementation** - Test what the system does, not how it does it
2. **Mock external dependencies** - API calls, auth, database
3. **Clear test names** - Describe expected behavior in plain English
4. **Arrange-Act-Assert** - Setup state, perform action, verify outcome
5. **Edge case coverage** - Empty states, validation errors, forbidden actions

## Adding New Tests

When adding new settings features:

1. Create test file in `tests/settings/`
2. Follow naming convention: `[feature-name].test.ts`
3. Use Vitest for test framework
4. Mock auth helpers (requireAdmin, getOrgContext)
5. Mock Supabase client for database operations
6. Document test scenarios in file header
7. Update this README with new test file details
