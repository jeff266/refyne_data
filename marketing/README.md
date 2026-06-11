# Refyne Marketing Website

Marketing website for refynedata.com built with Next.js 15 and Tailwind CSS.

## Design System

- **Fonts**: Lora (headings), Jost (body)
- **Colors**:
  - Background: `#0F1E30`
  - Surface: `#1C3654`
  - Accent: `#2E6BA8`
  - Text: `#F9F8F5`
  - Text Secondary: `rgba(249,248,245,0.75)`
  - Border: `rgba(255,255,255,0.08)`
- **No border-radius** - All components use sharp corners

## Pages

- `/` - Homepage with hero, features, pricing teaser
- `/pricing` - Full pricing page with 3 tiers + FAQ
- `/cookie-policy` - Cookie policy

## Development

```bash
npm run dev       # Start dev server
npm run build     # Build for production
npm run start     # Start production server
```

## Deployment

Deploy to Vercel:

1. Connect this repo to Vercel
2. Set root directory to `marketing`
3. Framework preset: Next.js
4. Deploy

## Components

- `Navigation` - Sticky nav with scroll-based background
- `Button` - Reusable button with primary/ghost/white variants
- `Footer` - 4-column footer with product/company/legal links

## Structure

```
app/
  page.tsx              # Homepage
  pricing/page.tsx      # Pricing page
  cookie-policy/page.tsx # Cookie policy
  layout.tsx            # Root layout with fonts
  globals.css           # Global styles
components/
  Navigation.tsx        # Site navigation
  Button.tsx           # Button component
  Footer.tsx           # Site footer
```
