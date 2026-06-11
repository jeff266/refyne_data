import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/Button';
import { Footer } from '@/components/Footer';
import { ArrowUpDown, GitMerge, Sparkles, Bell } from 'lucide-react';

export default function Home() {
  return (
    <>
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-[1100px] mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(255,255,255,0.12)] mb-8">
            <div className="w-2 h-2 rounded-full bg-[#FF7A59]"></div>
            <span className="text-sm text-text-2">Built for HubSpot</span>
          </div>

          <h1 className="font-lora text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Your HubSpot data.
            <br />
            <span
              className="bg-gradient-to-br from-[#2E6BA8] to-[#7C3AED] bg-clip-text text-transparent"
              style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              Finally clean.
            </span>
          </h1>
          <p className="text-xl text-text-2 mb-10 max-w-2xl mx-auto">
            Refyne normalizes formats, removes duplicates, and fixes data quality issues automatically, so your team always works from a single source of truth.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button href="https://app.refynedata.com/sign-up" variant="primary">
              Get started →
            </Button>
            <Button href="#how-it-works" variant="ghost">
              See how it works
            </Button>
          </div>

          {/* Trust Signal */}
          <p className="text-[13px] text-text-2 font-jost">
            No credit card required. 14-day free trial. Cancel anytime.
          </p>
        </div>
      </section>

      {/* What Refyne Does */}
      <section className="py-20 px-6 bg-surface">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <div className="section-label mb-4">WHAT REFYNE DOES</div>
            <h2 className="font-lora text-4xl font-bold mb-4">
              Four ways to fix your CRM
            </h2>
            <p className="text-text-2 max-w-2xl mx-auto">
              Refyne runs in the background, continuously cleaning and maintaining your HubSpot data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#1C3654] border border-[rgba(255,255,255,0.08)] p-8 rounded-xl">
              <div className="w-10 h-10 flex items-center justify-center bg-[rgba(46,107,168,0.2)] rounded-lg mb-4">
                <ArrowUpDown className="w-5 h-5 text-[#2E6BA8]" />
              </div>
              <h3 className="font-lora text-xl font-bold mb-3">Normalize</h3>
              <p className="text-text-2 text-sm mb-4">
                Standardize phone numbers, company names, titles, locations, and custom fields across your entire database.
              </p>
              <code className="block text-[13px] text-[rgba(249,248,245,0.6)] mt-3 font-[family-name:var(--font-jetbrains-mono)]">
                (555) 123-4567 → +1 555-123-4567
              </code>
            </div>

            <div className="bg-[#1C3654] border border-[rgba(255,255,255,0.08)] p-8 rounded-xl">
              <div className="w-10 h-10 flex items-center justify-center bg-[rgba(46,107,168,0.2)] rounded-lg mb-4">
                <GitMerge className="w-5 h-5 text-[#2E6BA8]" />
              </div>
              <h3 className="font-lora text-xl font-bold mb-3">Dedup</h3>
              <p className="text-text-2 text-sm mb-4">
                Identify and merge duplicate contacts and companies using intelligent matching algorithms.
              </p>
              <code className="block text-[13px] text-[rgba(249,248,245,0.6)] mt-3 font-[family-name:var(--font-jetbrains-mono)]">
                john.smith@co.com + johnsmith@co.com → 1 record
              </code>
            </div>

            <div className="bg-[#1C3654] border border-[rgba(255,255,255,0.08)] p-8 rounded-xl">
              <div className="w-10 h-10 flex items-center justify-center bg-[rgba(46,107,168,0.2)] rounded-lg mb-4">
                <Sparkles className="w-5 h-5 text-[#2E6BA8]" />
              </div>
              <h3 className="font-lora text-xl font-bold mb-3">Enrich</h3>
              <p className="text-text-2 text-sm mb-4">
                Fill in missing data like company info, job titles, and contact details from trusted sources.
              </p>
              <code className="block text-[13px] text-[rgba(249,248,245,0.6)] mt-3 font-[family-name:var(--font-jetbrains-mono)]">
                Missing phone → +1 555-987-6543
              </code>
            </div>

            <div className="bg-[#1C3654] border border-[rgba(255,255,255,0.08)] p-8 rounded-xl">
              <div className="w-10 h-10 flex items-center justify-center bg-[rgba(46,107,168,0.2)] rounded-lg mb-4">
                <Bell className="w-5 h-5 text-[#2E6BA8]" />
              </div>
              <h3 className="font-lora text-xl font-bold mb-3">Always On</h3>
              <p className="text-text-2 text-sm mb-4">
                Automatically clean new records as they enter your CRM, no manual work required.
              </p>
              <code className="block text-[13px] text-[rgba(249,248,245,0.6)] mt-3 font-[family-name:var(--font-jetbrains-mono)]">
                New contact → Cleaned in real-time
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <div className="section-label mb-4">HOW IT WORKS</div>
            <h2 className="font-lora text-4xl font-bold mb-4">
              Clean data in three steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="text-6xl font-lora font-bold text-accent mb-6 opacity-20">01</div>
              <h3 className="font-lora text-xl font-bold mb-3">Connect HubSpot</h3>
              <p className="text-text-2 text-sm">
                One-click OAuth connection. We only request the permissions we need, nothing more.
              </p>
            </div>

            <div className="text-center">
              <div className="text-6xl font-lora font-bold text-accent mb-6 opacity-20">02</div>
              <h3 className="font-lora text-xl font-bold mb-3">Configure rules</h3>
              <p className="text-text-2 text-sm">
                Choose which fields to normalize, which duplicates to merge, and what data to enrich.
              </p>
            </div>

            <div className="text-center">
              <div className="text-6xl font-lora font-bold text-accent mb-6 opacity-20">03</div>
              <h3 className="font-lora text-xl font-bold mb-3">Let it run</h3>
              <p className="text-text-2 text-sm">
                Refyne works in the background, cleaning your data 24/7. Review changes anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 px-6 bg-surface">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <div className="section-label mb-4">WHO IT'S FOR</div>
            <h2 className="font-lora text-4xl font-bold mb-4">
              Built for teams that rely on HubSpot
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-bg border border-border p-8 rounded-xl">
              <h3 className="font-lora text-xl font-bold mb-3">RevOps Teams</h3>
              <p className="text-text-2 text-sm">
                Stop spending hours on manual data cleanup. Automate normalization, deduplication, and enrichment so you can focus on strategy.
              </p>
            </div>

            <div className="bg-bg border border-border p-8 rounded-xl">
              <h3 className="font-lora text-xl font-bold mb-3">Sales Leaders</h3>
              <p className="text-text-2 text-sm">
                Give your reps clean, complete contact data. No more duplicate records, missing phone numbers, or formatting inconsistencies.
              </p>
            </div>

            <div className="bg-bg border border-border p-8 rounded-xl">
              <h3 className="font-lora text-xl font-bold mb-3">Marketing Teams</h3>
              <p className="text-text-2 text-sm">
                Run campaigns with confidence. Clean data means better segmentation, higher deliverability, and more accurate attribution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Proof Point / Testimonial */}
      <section className="py-20 px-6">
        <div className="max-w-[800px] mx-auto">
          <div className="border-l-4 border-accent pl-8 py-4">
            <p className="text-xl text-text-2 mb-6 italic">
              "Refyne saved us 15 hours a week on data cleanup. Our sales team finally trusts the data in HubSpot."
            </p>
            <div>
              <div className="font-bold">Jeff Ignacio</div>
              <div className="text-sm text-text-2">Founder, RevOps Impact</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-20 px-6 bg-surface">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-12">
            <div className="section-label mb-4">PRICING</div>
            <h2 className="font-lora text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-text-2">
              Starting at $149/month for up to 10,000 records
            </p>
          </div>

          <div className="max-w-md mx-auto bg-bg border border-border p-8 rounded-xl">
            <div className="mb-6">
              <div className="text-3xl font-lora font-bold mb-2">Starter</div>
              <div className="text-text-2 text-sm mb-4">Everything you need to get started</div>
              <div className="text-4xl font-lora font-bold">$149<span className="text-xl text-text-2">/mo</span></div>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-sm text-text-2">
                <span className="text-accent">✓</span>
                <span>Up to 10,000 records</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-text-2">
                <span className="text-accent">✓</span>
                <span>Unlimited normalization rules</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-text-2">
                <span className="text-accent">✓</span>
                <span>Automatic deduplication</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-text-2">
                <span className="text-accent">✓</span>
                <span>Basic enrichment (500 credits/mo)</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-text-2">
                <span className="text-accent">✓</span>
                <span>Email support</span>
              </li>
            </ul>

            <Button href="/pricing" variant="primary" className="w-full text-center">
              See all plans →
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-[#1C3654]">
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className="font-lora text-4xl font-bold mb-4">
            Ready to clean your HubSpot data?
          </h2>
          <p className="text-xl text-text-2 mb-10">
            Start your free trial today. No credit card required.
          </p>
          <Button href="https://app.refynedata.com/sign-up" variant="white">
            Get started →
          </Button>
        </div>
      </section>

      <Footer />
    </>
  );
}
