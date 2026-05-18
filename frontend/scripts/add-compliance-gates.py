#!/usr/bin/env python3
"""Add feature gates to compliance API routes."""

import re
from pathlib import Path

# Feature gate code to insert
FEATURE_GATE = """
  // Feature gate: compliance
  try {
    await requireFeature(ctx.orgId, 'compliance');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }
"""

# Files to update
files = [
    'app/api/compliance/alerts/route.ts',
    'app/api/compliance/breakdown/route.ts',
    'app/api/compliance/insights/route.ts',
    'app/api/compliance/records/route.ts',
    'app/api/compliance/scan/route.ts',
    'app/api/compliance/score/route.ts',
    'app/api/compliance/trend/route.ts',
]

for filepath in files:
    path = Path(filepath)
    if not path.exists():
        print(f"❌ Not found: {filepath}")
        continue

    content = path.read_text()

    # Check if already has feature gate
    if 'requireFeature' in content:
        print(f"⏭️  Already has gate: {filepath}")
        continue

    # Add import if not present
    if 'requireFeature' not in content:
        # Add to existing import from @/lib/billing/check-feature
        if 'from \'@/lib/billing/check-feature\'' in content:
            content = re.sub(
                r'(import\s*{[^}]*})\s*from\s*[\'"]@/lib/billing/check-feature[\'"]',
                r'\1 from \'@/lib/billing/check-feature\'',
                content
            )
        else:
            # Add new import after other imports
            import_line = "import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';\n"
            # Find last import statement
            last_import = max([m.end() for m in re.finditer(r'import .+ from .+;', content)])
            content = content[:last_import] + '\n' + import_line + content[last_import:]

    # Insert feature gate after auth check
    # Pattern: after the auth check block ending with the authError return
    pattern = r"(  let ctx;\n  try \{ ctx = getOrgContext\(\); \}\n  catch \(e\) \{ return authError\(e\) \?\? NextResponse\.json\(\{ error: 'Server error' \}, \{ status: 500 \}\); \})\n\n(  try \{)"

    if re.search(pattern, content):
        content = re.sub(
            pattern,
            r'\1' + FEATURE_GATE + r'\n\2',
            content
        )

        path.write_text(content)
        print(f"✅ Updated: {filepath}")
    else:
        print(f"⚠️  Pattern not found in: {filepath}")

print("\n✅ Done!")
