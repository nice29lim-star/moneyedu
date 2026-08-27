import React from 'react';

export const PixelBadge: React.FC<{
  children: React.ReactNode;
  variant?: 'gold' | 'blue' | 'green' | 'red' | 'purple' | 'slate' | 'dark';
  className?: string;
}> = ({ children, variant = 'blue', className = '' }) => {
  const styles = {
    gold: 'bg-[#FFD32D] text-[#1A1A1A] border-2 border-black shadow-[2px_2px_0px_0px_#000]',
    blue: 'bg-[#74B9FF] text-[#1A1A1A] border-2 border-black shadow-[2px_2px_0px_0px_#000]',
    green: 'bg-[#55E6C1] text-[#1A1A1A] border-2 border-black shadow-[2px_2px_0px_0px_#000]',
    red: 'bg-[#FF7675] text-white border-2 border-black shadow-[2px_2px_0px_0px_#000]',
    purple: 'bg-[#A29BFE] text-[#1A1A1A] border-2 border-black shadow-[2px_2px_0px_0px_#000]',
    slate: 'bg-white text-[#2D3436] border-2 border-black shadow-[2px_2px_0px_0px_#000]',
    dark: 'bg-[#1A1A1A] text-white border-2 border-black shadow-[2px_2px_0px_0px_#000]',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-xl ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export const PixelCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  borderVariant?: 'default' | 'gold' | 'cyan' | 'rose' | 'vibrantBlue' | 'vibrantPink' | 'vibrantYellow' | 'vibrantGreen';
}> = ({ children, className = '', glow = false, borderVariant = 'default' }) => {
  const borderStyles = {
    default: 'bg-white border-4 border-black text-[#2D3436] shadow-[6px_6px_0px_0px_#000]',
    gold: 'bg-[#FFFBEB] border-4 border-black text-[#2D3436] shadow-[6px_6px_0px_0px_#000]',
    cyan: 'bg-[#EBF7FF] border-4 border-black text-[#2D3436] shadow-[6px_6px_0px_0px_#000]',
    rose: 'bg-[#FFF0F0] border-4 border-black text-[#2D3436] shadow-[6px_6px_0px_0px_#000]',
    vibrantBlue: 'bg-[#74B9FF] border-4 border-black text-[#2D3436] shadow-[8px_8px_0px_0px_#000]',
    vibrantPink: 'bg-[#FFB8B8] border-4 border-black text-[#2D3436] shadow-[8px_8px_0px_0px_#000]',
    vibrantYellow: 'bg-[#FFD32D] border-4 border-black text-[#2D3436] shadow-[8px_8px_0px_0px_#000]',
    vibrantGreen: 'bg-[#55E6C1] border-4 border-black text-[#2D3436] shadow-[8px_8px_0px_0px_#000]',
  };

  return (
    <div
      className={`relative rounded-3xl transition-all duration-200 ${
        borderStyles[borderVariant]
      } ${glow ? 'ring-2 ring-black' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

export const PixelButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'gold' | 'dark';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  id?: string;
  title?: string;
}> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  size = 'md',
  className = '',
  type = 'button',
  id,
  title,
}) => {
  const base =
    'relative inline-flex items-center justify-center font-black uppercase transition-all duration-100 rounded-xl border-2 border-black cursor-pointer select-none';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantStyles = {
    primary:
      'bg-[#74B9FF] hover:bg-[#5fa8f7] text-[#1A1A1A] shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000]',
    secondary:
      'bg-white hover:bg-[#F1F2F6] text-[#2D3436] shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000]',
    success:
      'bg-[#55E6C1] hover:bg-[#3ce2b7] text-[#1A1A1A] shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000]',
    danger:
      'bg-[#FF7675] hover:bg-[#ff5e5d] text-white shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000]',
    gold:
      'bg-[#FFD32D] hover:bg-[#f6c61b] text-[#1A1A1A] shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000]',
    dark:
      'bg-[#1A1A1A] hover:bg-[#2D3436] text-white shadow-[3px_3px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000]',
  };

  const disabledStyles = 'opacity-40 cursor-not-allowed grayscale pointer-events-none shadow-none translate-x-0 translate-y-0';

  return (
    <button
      id={id}
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizeStyles[size]} ${variantStyles[variant]} ${
        disabled ? disabledStyles : ''
      } ${className}`}
    >
      {children}
    </button>
  );
};
