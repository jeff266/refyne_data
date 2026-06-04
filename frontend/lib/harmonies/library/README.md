# Harmony Library

This directory contains the built-in Harmony YAML files and the code to load them.

## How It Works

The Harmony library uses a **build-time bundling approach** to ensure YAML files are available in production environments (like Vercel) where filesystem access is restricted.

### Build Process

1. **YAML Files** - All harmony definitions are stored as `.yaml` files in this directory
2. **Generation Script** - `scripts/generate-harmony-bundle.ts` reads all YAML files and generates `generated-bundle.ts`
3. **Bundle File** - `generated-bundle.ts` contains all YAML content as inline TypeScript strings
4. **Build Hook** - `npm run build` automatically runs the generation script before Next.js build

### Why This Approach?

**Problem**: Vercel's serverless functions don't include files via `outputFileTracingIncludes` reliably, causing ENOENT errors for YAML files in production.

**Solution**: Bundle YAML content directly into the JavaScript at build time, eliminating runtime filesystem dependencies.

### Usage

```typescript
import { getLibraryHarmonies, getHarmonyById } from '@/lib/harmonies/library';

// Get all harmonies
const allHarmonies = getLibraryHarmonies();

// Get specific harmony
const harmony = getHarmonyById('company-name');
```

## Development

### Adding a New Harmony

1. Create a new `.yaml` file in this directory (e.g., `my-harmony.yaml`)
2. Run `npm run generate:harmonies` to regenerate the bundle
3. The harmony will automatically be included in the next build

### Testing Changes

```bash
# Regenerate bundle
npm run generate:harmonies

# Run tests
npm test -- lib/harmonies/library/library.test.ts

# Test loading
npx tsx -e "console.log(require('./lib/harmonies/library').getLibraryHarmonies().length)"
```

### Files

- `*.yaml` - Individual harmony definitions (18 files)
- `index.ts` - Main library module that loads harmonies
- `generated-bundle.ts` - Auto-generated bundle (not in git)
- `library.test.ts` - Test suite

## Production Deployment

The build process ensures all YAML files are bundled:

```bash
npm run build
# Runs: npm run generate:harmonies && next build
```

This creates `generated-bundle.ts` which is imported by `index.ts` at runtime, providing all YAML content without filesystem access.

## Troubleshooting

### "Generated bundle not found" warning

This is normal during development. The library falls back to reading YAML files from disk.

To suppress the warning, run: `npm run generate:harmonies`

### Build fails with "Module not found: generated-bundle"

Run the generation script manually:

```bash
npm run generate:harmonies
npm run build
```

### Changes to YAML files not reflected

Regenerate the bundle:

```bash
npm run generate:harmonies
```
