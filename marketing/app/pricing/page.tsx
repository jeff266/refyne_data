import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/Button';
import { Footer } from '@/components/Footer';

export default function Pricing() {
  return (
    <>
      <Navigation />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="section-label mb-4">PRICING</div>
          <h1 className="font-lora text-5xl font-bold mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-text-2 max-w-2xl mx-auto">
            Choose the plan that fits your team. All plans include unlimited users and 14-day free trial.
          </p>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="pb-20 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter */}
            <div className="bg-surface border border-border p-8 rounded-xl">
              <div className="mb-6">
                <h3 className="text-2xl font-lora font-bold mb-2">Starter</h3>
                <p className="text-text-2 text-sm mb-4">For small teams getting started</p>
                <div className="text-4xl font-lora font-bold">
                  $149<span className="text-xl text-text-2">/mo</span>
                </div>
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
                  <span>500 enrichment credits/mo</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-accent">✓</span>
                  <span>Email support</span>
                </li>
              </ul>

              <Button href="https://app.refynedata.com/sign-up" variant="ghost" className="w-full text-center">
                Start free trial
              </Button>
            </div>

            {/* Growth (Recommended) */}
            <div className="bg-accent border-2 border-accent p-8 relative rounded-xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent px-4 py-1 text-xs font-bold text-white rounded-full">
                RECOMMENDED
              </div>
              <div className="mb-6">
                <h3 className="text-2xl font-lora font-bold mb-2">Growth</h3>
                <p className="text-text-2 text-sm mb-4">For scaling teams with more data</p>
                <div className="text-4xl font-lora font-bold">
                  $349<span className="text-xl text-text-2">/mo</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-white">✓</span>
                  <span>Up to 50,000 records</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-white">✓</span>
                  <span>Unlimited normalization rules</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-white">✓</span>
                  <span>Automatic deduplication</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-white">✓</span>
                  <span>2,000 enrichment credits/mo</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-white">✓</span>
                  <span>Priority support</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-white">✓</span>
                  <span>Custom field normalization</span>
                </li>
              </ul>

              <Button href="https://app.refynedata.com/sign-up" variant="white" className="w-full text-center">
                Start free trial
              </Button>
            </div>

            {/* Enterprise */}
            <div className="bg-surface border border-border p-8 rounded-xl">
              <div className="mb-6">
                <h3 className="text-2xl font-lora font-bold mb-2">Enterprise</h3>
                <p className="text-text-2 text-sm mb-4">For large organizations</p>
                <div className="text-4xl font-lora font-bold">Custom</div>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-accent">✓</span>
                  <span>Unlimited records</span>
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
                  <span>Custom enrichment credits</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-accent">✓</span>
                  <span>Dedicated support + onboarding</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-accent">✓</span>
                  <span>Custom integrations</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-text-2">
                  <span className="text-accent">✓</span>
                  <span>SLA & uptime guarantees</span>
                </li>
              </ul>

              <Button href="#contact" variant="ghost" className="w-full text-center">
                Contact sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-surface">
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-lora text-4xl font-bold mb-4">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="font-lora text-xl font-bold mb-3">
                What counts as a "record"?
              </h3>
              <p className="text-text-2">
                A record is any company or contact in your HubSpot CRM. For example, if you have 5,000 companies and 8,000 contacts, that's 13,000 total records.
              </p>
            </div>

            <div>
              <h3 className="font-lora text-xl font-bold mb-3">
                How do enrichment credits work?
              </h3>
              <p className="text-text-2">
                Each enrichment credit fills in one missing field (like a phone number or company size). Credits refresh monthly and don't roll over. You can purchase additional credits if needed.
              </p>
            </div>

            <div>
              <h3 className="font-lora text-xl font-bold mb-3">
                Can I cancel anytime?
              </h3>
              <p className="text-text-2">
                Yes. You can cancel your subscription at any time from your account settings. You'll have access until the end of your billing period.
              </p>
            </div>

            <div>
              <h3 className="font-lora text-xl font-bold mb-3">
                Do you offer annual billing?
              </h3>
              <p className="text-text-2">
                Yes! Annual plans get 2 months free (save 16%). Contact us to set up annual billing.
              </p>
            </div>

            <div>
              <h3 className="font-lora text-xl font-bold mb-3">
                What happens during the free trial?
              </h3>
              <p className="text-text-2">
                You get full access to all features for 14 days. No credit card required to start. We'll email you before the trial ends.
              </p>
            </div>

            <div>
              <h3 className="font-lora text-xl font-bold mb-3">
                Is my data secure?
              </h3>
              <p className="text-text-2">
                Absolutely. We use bank-level encryption, SOC 2 Type II compliance, and never store your HubSpot credentials. We only request the minimum permissions needed to clean your data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className="font-lora text-4xl font-bold mb-4">
            Still have questions?
          </h2>
          <p className="text-xl text-text-2 mb-10">
            Get in touch with our team. We're happy to help you find the right plan.
          </p>
          <Button href="mailto:hello@refynedata.com" variant="primary">
            Contact us
          </Button>
        </div>
      </section>

      <Footer />
    </>
  );
}
