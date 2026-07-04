"use client";

import { ButtonHTMLAttributes, MouseEvent, useState } from "react";

type RippleItem = {
  id: number;
  x: number;
  y: number;
  size: number;
};

type RippleButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export default function RippleButton({
  className = "",
  onClick,
  children,
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<RippleItem[]>([]);

  const addRipple = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    const id = Date.now();

    setRipples((prev) => [...prev, { id, x, y, size }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
    }, 600);
  };

  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        addRipple(event);
        onClick?.(event);
      }}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="animate-ripple pointer-events-none absolute rounded-full bg-lime-900/10"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}
    </button>
  );
}
