import Link from 'next/link';

interface ButtonProps {
  href: string;
  variant?: 'primary' | 'ghost' | 'white';
  children: React.ReactNode;
  className?: string;
}

export function Button({ href, variant = 'primary', children, className = '' }: ButtonProps) {
  const baseStyles = 'inline-block px-6 py-3 font-medium transition-all text-center rounded-lg';

  const variantStyles = {
    primary: 'bg-accent text-white hover:bg-opacity-90 font-medium',
    ghost: 'border border-border text-text hover:border-accent hover:text-accent font-medium',
    white: 'bg-white text-[#162944] hover:bg-opacity-90 font-medium',
  };

  return (
    <Link
      href={href}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
