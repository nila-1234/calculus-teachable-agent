"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    "bg-lime-600 text-white hover:bg-lime-700 disabled:bg-stone-200 disabled:text-stone-400",
  secondary:
    "bg-white text-stone-700 border border-stone-200 hover:border-stone-300 hover:bg-stone-50 disabled:text-stone-300 disabled:bg-stone-50",
  ghost:
    "bg-transparent text-stone-500 hover:bg-stone-100 disabled:text-stone-300",
};

const SIZE_STYLES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-11 px-5 text-sm",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-600 ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export default Button;
