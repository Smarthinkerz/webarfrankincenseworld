import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

const variants = {
  primary: 'bg-cyan text-ink hover:bg-white',
  secondary: 'bg-white/10 text-white hover:bg-white/15 border border-white/15',
  ghost: 'bg-transparent text-white/75 hover:text-white'
};

type Variant = keyof typeof variants;

export function Button({ className, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={clsx('inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50', variants[variant], className)} {...props} />;
}

export function ButtonLink({ children, className, variant = 'primary', href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: Variant; children: ReactNode }) {
  return <Link href={href} className={clsx('inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition', variants[variant], className)} {...props}>{children}</Link>;
}
