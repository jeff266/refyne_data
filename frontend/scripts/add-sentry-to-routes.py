#!/usr/bin/env python3
"""
Add Sentry error tracking to all API routes.

This script:
1. Adds import for captureWithOrgContext at the top of each route file
2. Wraps catch blocks that use console.error with captureWithOrgContext
3. Keeps the existing console.error statements
"""

import os
import re
from pathlib import Path

# Track statistics
stats = {
    'files_updated': 0,
    'catch_blocks_instrumented': 0,
    'files_skipped': 0,
}

def should_skip_file(file_path: str) -> bool:
    """Check if the file should be skipped (public marketing routes)."""
    # Skip public marketing routes
    skip_patterns = [
        '/api/config/route.ts',  # This is a demo route
    ]
    for pattern in skip_patterns:
        if pattern in file_path:
            return True
    return False

def has_org_context(content: str) -> bool:
    """Check if the file uses getOrgContext or requireAdmin."""
    return 'getOrgContext' in content or 'requireAdmin' in content

def extract_org_id(content: str) -> str:
    """Extract the orgId variable name from the file."""
    # Look for patterns like: const ctx = await getOrgContext()
    # or: ctx = await requireAdmin()
    # Then look for: ctx.orgId
    if 'ctx.orgId' in content:
        return 'ctx.orgId'
    if 'orgId' in content:
        return 'orgId'
    return 'ctx.orgId'  # Default

def get_route_name(file_path: str) -> str:
    """Extract route name from file path."""
    # Convert path like /app/api/compliance/scan/route.ts to /api/compliance/scan
    parts = file_path.split('/app/api/')
    if len(parts) > 1:
        route = '/api/' + parts[1].replace('/route.ts', '')
        return route
    return file_path

def add_sentry_import(content: str) -> str:
    """Add Sentry import if not present."""
    if 'captureWithOrgContext' in content:
        return content

    # Find the first import statement
    import_match = re.search(r"^import\s", content, re.MULTILINE)
    if import_match:
        # Add the Sentry import before the first import
        sentry_import = "import { captureWithOrgContext } from '@/lib/monitoring/sentry';\n"
        content = content[:import_match.start()] + sentry_import + content[import_match.start():]

    return content

def instrument_catch_blocks(content: str, file_path: str) -> tuple[str, int]:
    """Add captureWithOrgContext to catch blocks."""
    count = 0

    if not has_org_context(content):
        # Skip files that don't have org context
        return content, count

    org_id_var = extract_org_id(content)
    route_name = get_route_name(file_path)

    # Pattern to find catch blocks with console.error
    # Match: } catch (error) { ... console.error('...', error) ... }

    # Find all catch blocks
    catch_pattern = r'\}\s*catch\s*\((\w+)\)\s*\{'

    lines = content.split('\n')
    new_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this line starts a catch block
        catch_match = re.search(catch_pattern, line)
        if catch_match:
            error_var = catch_match.group(1)

            # Look ahead to find console.error in this catch block
            # Track brace depth to find the catch block scope
            brace_depth = line.count('{') - line.count('}')
            catch_start = i
            has_console_error = False
            console_error_line = -1

            j = i + 1
            while j < len(lines) and brace_depth > 0:
                brace_depth += lines[j].count('{') - lines[j].count('}')

                if 'console.error' in lines[j] and not 'captureWithOrgContext' in lines[j]:
                    has_console_error = True
                    console_error_line = j

                j += 1

            # If we found a console.error, add captureWithOrgContext before it
            if has_console_error and console_error_line > 0:
                new_lines.append(line)

                # Add all lines up to console.error
                for k in range(i + 1, console_error_line):
                    new_lines.append(lines[k])

                # Add captureWithOrgContext before console.error
                indent = len(lines[console_error_line]) - len(lines[console_error_line].lstrip())
                indent_str = ' ' * indent

                new_lines.append(f"{indent_str}captureWithOrgContext({error_var}, {org_id_var}, {{ route: '{route_name}' }});")
                new_lines.append(lines[console_error_line])

                # Add remaining lines in catch block
                for k in range(console_error_line + 1, j):
                    new_lines.append(lines[k])

                count += 1
                i = j
                continue

        new_lines.append(line)
        i += 1

    return '\n'.join(new_lines), count

def process_file(file_path: str):
    """Process a single route file."""
    if should_skip_file(file_path):
        stats['files_skipped'] += 1
        return

    with open(file_path, 'r') as f:
        content = f.read()

    # Skip if no org context
    if not has_org_context(content):
        stats['files_skipped'] += 1
        return

    # Add import
    new_content = add_sentry_import(content)

    # Instrument catch blocks
    new_content, count = instrument_catch_blocks(new_content, file_path)

    if count > 0:
        with open(file_path, 'w') as f:
            f.write(new_content)

        stats['files_updated'] += 1
        stats['catch_blocks_instrumented'] += count
        print(f"Updated {file_path}: {count} catch blocks instrumented")
    else:
        stats['files_skipped'] += 1

def main():
    # Find all route.ts files in app/api
    api_dir = Path(__file__).parent.parent / 'app' / 'api'
    route_files = list(api_dir.glob('**/route.ts'))

    print(f"Found {len(route_files)} route files")
    print("Processing...")

    for route_file in route_files:
        process_file(str(route_file))

    print("\n" + "="*60)
    print("Summary:")
    print(f"  Files updated: {stats['files_updated']}")
    print(f"  Catch blocks instrumented: {stats['catch_blocks_instrumented']}")
    print(f"  Files skipped: {stats['files_skipped']}")
    print("="*60)

if __name__ == '__main__':
    main()
