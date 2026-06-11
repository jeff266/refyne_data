import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export default function CookiePolicy() {
  return (
    <>
      <Navigation />

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-[800px] mx-auto">
          <h1 className="font-lora text-5xl font-bold mb-6">Cookie Policy</h1>
          <p className="text-text-2 mb-12">Last updated: June 10, 2026</p>

          <div className="space-y-8 text-text-2">
            <div>
              <h2 className="font-lora text-2xl font-bold text-text mb-4">What Are Cookies</h2>
              <p>
                Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently and provide information to website owners.
              </p>
            </div>

            <div>
              <h2 className="font-lora text-2xl font-bold text-text mb-4">How We Use Cookies</h2>
              <p className="mb-4">
                Refyne uses cookies to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Keep you signed in to your account</li>
                <li>Remember your preferences and settings</li>
                <li>Understand how you use our website to improve performance</li>
                <li>Provide security and prevent fraud</li>
              </ul>
            </div>

            <div>
              <h2 className="font-lora text-2xl font-bold text-text mb-4">Types of Cookies We Use</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-text mb-2">Essential Cookies</h3>
                  <p>
                    These cookies are necessary for the website to function properly. They enable core functionality such as security, authentication, and network management. You cannot opt-out of these cookies.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-text mb-2">Analytics Cookies</h3>
                  <p>
                    These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. We use this data to improve our website's performance and user experience.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-text mb-2">Preference Cookies</h3>
                  <p>
                    These cookies allow our website to remember choices you make (such as your username, language, or region) and provide enhanced, more personalized features.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-lora text-2xl font-bold text-text mb-4">Third-Party Cookies</h2>
              <p className="mb-4">
                We use the following third-party services that may set cookies:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Clerk</strong> - For authentication and user management</li>
                <li><strong>Vercel Analytics</strong> - For website performance monitoring</li>
                <li><strong>Sentry</strong> - For error tracking and monitoring</li>
              </ul>
            </div>

            <div>
              <h2 className="font-lora text-2xl font-bold text-text mb-4">Managing Cookies</h2>
              <p className="mb-4">
                Most web browsers allow you to control cookies through their settings. You can:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Delete cookies that have already been set</li>
                <li>Block all cookies from being set</li>
                <li>Allow cookies only from specific websites</li>
              </ul>
              <p className="mt-4">
                Please note that blocking all cookies will have a negative impact on the usability of many websites, including ours. If you block cookies, you may not be able to use all features of our website.
              </p>
            </div>

            <div>
              <h2 className="font-lora text-2xl font-bold text-text mb-4">Cookie Retention</h2>
              <p>
                Most cookies are session-based and expire when you close your browser. Some cookies persist for longer periods to remember your preferences across sessions. You can view and delete these cookies at any time through your browser settings.
              </p>
            </div>

            <div>
              <h2 className="font-lora text-2xl font-bold text-text mb-4">Updates to This Policy</h2>
              <p>
                We may update this Cookie Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </div>

            <div>
              <h2 className="font-lora text-2xl font-bold text-text mb-4">Contact Us</h2>
              <p>
                If you have questions about our use of cookies, please contact us at{' '}
                <a href="mailto:privacy@refynedata.com" className="text-accent hover:underline">
                  privacy@refynedata.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
