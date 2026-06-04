# Harmony YAML Files - Production Build Fix

## Problem

All 18 YAML harmony files were showing ENOENT (file not found) errors in Vercel production builds despite using `outputFileTracingIncludes` in `next.config.js`.

```javascript
// This didn't work reliably:
experimental: {
  outputFileTracingIncludes: {
    '/': ['./lib/harmonies/library/*.yaml'],
    '/api/**/*': ['./lib/harmonies/library/*.yaml'],
  },
}
```

## Root Cause

Vercel's serverless functions use Next.js output file tracing, which:
- Is unreliable for non-standard file types (YAML)
- Doesn't always respect glob patterns in `outputFileTracingIncludes`
- Can't guarantee filesystem access in serverless environments

## Solution Implemented

**Build-time bundling** - Generate a TypeScript file that inlines all YAML content as strings.

### Changes Made

1. **Created generation script** - `scripts/generate-harmony-bundle.ts`
   - Reads all `*.yaml` files from `lib/harmonies/library/`
   - Generates `generated-bundle.ts` with YAML content as template literals
   - Escapes special characters for safe embedding

2. **Updated library loader** - `lib/harmonies/library/index.ts`
   - Imports `generated-bundle.ts` (created at build time)
   - Falls back to filesystem for local development
   - Loads YAML from in-memory bundle instead of `readFileSync()`

3. **Added build hook** - `package.json`
   ```json
   {
     "scripts": {
       "build": "npm run generate:harmonies && next build",
       "generate:harmonies": "npx tsx scripts/generate-harmony-bundle.ts"
     }
   }
   ```

4. **Removed unreliable config** - `next.config.js`
   - Removed `outputFileTracingIncludes` (no longer needed)

5. **Added to .gitignore**
   - `generated-bundle.ts` is build artifact, not source code

### How It Works

```
┌─────────────────┐
│  Build Process  │
└────────┬────────┘
         │
         ├─> npm run generate:harmonies
         │   └─> Reads 18 .yaml files
         │       └─> Generates generated-bundle.ts
         │           (92KB, 3,441 lines)
         │
         ├─> next build
         │   └─> Bundles generated-bundle.ts into JS chunks
         │       └─> HARMONY_YAML_BUNDLE available at runtime
         │
         └─> Production deployment
             └─> No filesystem access needed
                 └─> All YAML content is in memory
```

## Benefits

1. **Reliable** - YAML content is guaranteed to be in the bundle
2. **Fast** - No filesystem I/O at runtime
3. **Simple** - No special Vercel config or workarounds needed
4. **Maintainable** - Adding new YAML files just requires rebuild
5. **Testable** - Works identically in dev, build, and production

## Testing

All 18 harmony files are successfully bundled:

```bash
$ npm run generate:harmonies
Found 18 YAML files
✓ Generated .../generated-bundle.ts
  Bundled 18 files: address-country.yaml, address-state.yaml, ...

$ npm run build
✓ Build succeeded
✓ HARMONY_YAML_BUNDLE found in build output

$ npm test -- lib/harmonies/library/library.test.ts
✓ 71 tests passed
```

## Files Changed

- `/scripts/generate-harmony-bundle.ts` - New generation script
- `/lib/harmonies/library/index.ts` - Updated to use bundle
- `/lib/harmonies/library/README.md` - Documentation
- `/package.json` - Added build hook
- `/next.config.js` - Removed outputFileTracingIncludes
- `/.gitignore` - Added generated-bundle.ts

## Deployment

On Vercel:
1. Build runs `npm run generate:harmonies` automatically
2. All YAML content is bundled into JavaScript
3. No ENOENT errors in production

## Why This Is Better Than Alternatives

### Alternative 1: Copy files with webpack config
- ❌ Requires custom webpack configuration
- ❌ Files still need filesystem access
- ❌ Doesn't work well with Next.js app router

### Alternative 2: Use `output: 'standalone'`
- ❌ Changes deployment strategy
- ❌ Still unreliable with outputFileTracingIncludes
- ❌ Requires more Vercel configuration

### Alternative 3: Load YAML from environment variables
- ❌ 18 files = too large for env vars
- ❌ Hard to maintain
- ❌ Deployment configuration becomes complex

### Our Solution: Build-time bundling
- ✅ Works with default Next.js config
- ✅ No runtime dependencies
- ✅ Zero configuration on Vercel
- ✅ Fast and reliable
- ✅ Easy to maintain

## References

- [Next.js outputFileTracingIncludes discussion](https://github.com/vercel/next.js/discussions/55228)
- [outputFileTracingIncludes not working](https://github.com/vercel/next.js/discussions/47293)
- [Vercel serverless functions file access](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions)
