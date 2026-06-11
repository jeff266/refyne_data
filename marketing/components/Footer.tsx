import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[#0A1829] border-t border-border">
      <div className="max-w-[1100px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="text-xl font-lora font-bold mb-2">Refyne</div>
            <p className="text-text-2 text-sm">
              The CRM data layer for HubSpot.
            </p>
          </div>

          <div>
            <h3 className="text-text font-medium mb-4 text-sm">Product</h3>
            <ul className="space-y-3">
              {['Normalize', 'Dedup', 'Enrich', 'Import'].map((item) => (
                <li key={item}>
                  <Link
                    href="#"
                    className="text-text-2 hover:text-accent transition-colors text-sm"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-text font-medium mb-4 text-sm">Company</h3>
            <ul className="space-y-3">
              {['About', 'Blog', 'Pricing', 'Contact'].map((item) => (
                <li key={item}>
                  <Link
                    href={item === 'Pricing' ? '/pricing' : '#'}
                    className="text-text-2 hover:text-accent transition-colors text-sm"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-text font-medium mb-4 text-sm">Legal</h3>
            <ul className="space-y-3">
              {[
                { label: 'Privacy policy', href: '#' },
                { label: 'Terms of service', href: '#' },
                { label: 'Cookie policy', href: '/cookie-policy' },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-text-2 hover:text-accent transition-colors text-sm"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[rgba(255,255,255,0.06)] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-text-2 text-sm">
            © 2026 Refyne Data, Inc.
          </div>
        </div>
      </div>
    </footer>
  );
}
