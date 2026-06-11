'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-bg' : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-text font-lora text-xl font-bold">
          Refyne
        </Link>

        <div className="flex items-center gap-8">
          <Link
            href="/pricing"
            className="text-text-2 hover:text-text transition-colors text-sm"
          >
            Pricing
          </Link>
          <Link
            href="https://app.refynedata.com/sign-in"
            className="text-text-2 hover:text-text transition-colors text-sm"
          >
            Sign in
          </Link>
          <Link
            href="https://app.refynedata.com/sign-up"
            className="bg-accent text-white px-6 py-2 hover:bg-opacity-90 transition-all text-sm font-medium"
          >
            Get started →
          </Link>
        </div>
      </div>
    </nav>
  );
}
