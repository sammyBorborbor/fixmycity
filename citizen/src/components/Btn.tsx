import type { ButtonHTMLAttributes } from 'react';
import Icon from './Icon.tsx';

const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3.5 text-base' };
const variants = {
  primary:  'bg-navy text-white hover:bg-[#0d2c55] shadow-sm',
  gold:     'bg-gold text-white hover:brightness-105 shadow-sm',
  ocean:    'bg-ocean text-white hover:brightness-105 shadow-sm',
  outline:  'bg-white text-navy ring-1 ring-inset ring-gray-300 hover:bg-gray-50',
  danger:   'bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50',
  ghost:    'text-navy hover:bg-gray-100',
  green:    'bg-green-600 text-white hover:bg-green-700 shadow-sm',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  icon?: string;
}

/* Small reusable button. */
export default function Btn({ children, variant = 'primary', size = 'md', className = '', icon, ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition active:scale-[.98] focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 16} />}
      {children}
    </button>
  );
}
