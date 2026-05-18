# QA Checks

Standard quality assurance checks to run before marking tasks complete.

---

## Route Coverage Check

Run this check before marking any integration or API-wiring task complete.

### Steps

1. **Enumerate all API routes:**
   - Find every file matching `app/api/**/route.ts`
   - For each file, extract the exported HTTP method handlers (GET, POST, PUT, DELETE, PATCH)
   - Derive the route path from the file path (e.g. `app/api/compliance/score/route.ts` → `/api/compliance/score`)

2. **Check frontend references for each route:**
   - Search all `.ts` and `.tsx` files under `app/` and `components/` (excluding the route files themselves)
   - Look for the route path string appearing in: fetch() calls, server component data fetches, SWR/React Query hooks, API utility wrappers, and string constants
   - Count total references per route

3. **Output a coverage table:**

   ```
   Route coverage
   ─────────────────────────────────────────────────
   ✓  GET  /api/compliance/score       3 references
   ✓  GET  /api/compliance/breakdown   2 references
   ⚠  GET  /api/compliance/records     0 references  ← orphaned
   ⚠  POST /api/compliance/scan        0 references  ← orphaned
   ─────────────────────────────────────────────────
   N covered · N orphaned
   ```

4. **For each orphaned route, state one of:**
   - **INTENTIONAL:** route is built but UI not yet designed (note which milestone it belongs to)
   - **MISSING:** route has a designed UI surface but was never wired up (flag as a task)
   - **STALE:** route appears to be superseded or unused (flag for deletion)

### Pass Criteria

Zero MISSING routes. INTENTIONAL and STALE orphans are acceptable but must be explicitly labeled, not silently ignored.

### Route Classification Reference

Routes with zero references fall into three categories:

**INTENTIONAL** - Route is built, UI planned but not yet implemented:
- `POST /api/compliance/insights` - Compliance insights generation endpoint
- `GET /api/compliance/records` - Compliance record retrieval
- `GET /api/compliance/alerts` - Compliance alert listing
- `POST /api/compliance/alerts` - Compliance alert creation
- `GET /api/compliance/scan` - Manual compliance scan status
- `POST /api/compliance/scan` - Trigger manual compliance scan
- `POST /api/hubspot/connect` - PAT-based connection method (active until OAuth ships)

**DEFERRED** - Route was superseded by newer implementation:
- `GET /api/always-on/config` - Removed 2026-05-18, superseded by `/api/always-on/status`

**MISSING** - Route has designed UI but was never wired up (should not exist - flag as bug)

### Notes

- Dynamic route segments (e.g. `/api/harmonies/[id]`) should match against any reference containing the base path (`/api/harmonies/`)
- Do not count references inside `*.test.ts` files as frontend coverage
- Run the check using bash tools rather than loading all files into context
- Update the classification reference above when adding new orphaned routes or removing old ones

### Script

```bash
#!/bin/bash
# Route Coverage Check Script

echo "Route Coverage Check"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Find all route files and extract methods
route_files=$(find app/api -name "route.ts" 2>/dev/null)

covered=0
orphaned=0

for route_file in $route_files; do
  # Convert file path to API route
  route_path=$(echo "$route_file" | sed 's|app/api|/api|' | sed 's|/route.ts||')

  # Handle dynamic segments for display
  display_path=$(echo "$route_path" | sed 's|\[.*\]|{param}|g')

  # Extract HTTP methods from the file
  methods=$(grep -E "^export (async )?function (GET|POST|PUT|DELETE|PATCH)" "$route_file" | \
            grep -oE "(GET|POST|PUT|DELETE|PATCH)" | sort -u)

  for method in $methods; do
    # Search for references (excluding test files and the route file itself)
    # For dynamic routes, search for the base path
    search_path=$(echo "$route_path" | sed 's|\[.*\].*||')

    ref_count=$(grep -r "$search_path" app/ components/ lib/ --include="*.ts" --include="*.tsx" \
                2>/dev/null | grep -v "route.ts" | grep -v ".test.ts" | wc -l | tr -d ' ')

    if [ "$ref_count" -gt 0 ]; then
      printf "✓  %-6s %-35s %s references\n" "$method" "$display_path" "$ref_count"
      ((covered++))
    else
      printf "⚠  %-6s %-35s 0 references  ← orphaned\n" "$method" "$display_path"
      ((orphaned++))
    fi
  done
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "$covered covered · $orphaned orphaned"
```

---

## Test Suite Check

Run before marking any phase complete.

### Steps

1. Run `npm test`
2. Verify all tests pass
3. Report exact counts: test files and total tests

### Pass Criteria

- Zero failing tests
- Test count should not decrease from previous run

---

## TypeScript Check

Run before marking any code change complete.

### Steps

1. Run `npx tsc --noEmit`
2. Report any errors (excluding test files if needed)

### Pass Criteria

- Zero TypeScript errors in non-test files
- Test file errors should be flagged but don't block

---

## Build Check

Run before marking any feature complete.

### Steps

1. Run `npm run build`
2. Verify build succeeds
3. Check for any warnings that indicate issues

### Pass Criteria

- Build completes without errors
- No critical warnings

---

## Lint Check

Run before marking any PR ready.

### Steps

1. Run `npm run lint` (if configured)
2. Report violations

### Pass Criteria

- Zero errors (warnings acceptable)
