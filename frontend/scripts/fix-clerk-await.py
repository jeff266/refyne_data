#!/usr/bin/env python3
"""Fix Clerk auth helper calls to use await."""

import re
from pathlib import Path

def fix_file(filepath):
    """Add await to Clerk auth helper calls."""
    content = Path(filepath).read_text()
    original = content

    # Pattern 1: ctx = getOrgContext()
    content = re.sub(
        r'(\s+)ctx = getOrgContext\(\);',
        r'\1ctx = await getOrgContext();',
        content
    )

    # Pattern 2: ctx = requireAdmin()
    content = re.sub(
        r'(\s+)ctx = requireAdmin\(\);',
        r'\1ctx = await requireAdmin();',
        content
    )

    # Pattern 3: ctx = requireOperatorOrAbove()
    content = re.sub(
        r'(\s+)ctx = requireOperatorOrAbove\(\);',
        r'\1ctx = await requireOperatorOrAbove();',
        content
    )

    if content != original:
        Path(filepath).write_text(content)
        return True
    return False

# Find all API route files
api_routes = list(Path('app/api').rglob('route.ts'))

updated = 0
for route in api_routes:
    if fix_file(route):
        print(f'✅ Fixed: {route}')
        updated += 1

print(f'\n✅ Updated {updated} files')
