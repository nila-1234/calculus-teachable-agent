"use client";

import { Theme } from "@radix-ui/themes";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Theme
      appearance="light"
      accentColor="cyan"
      grayColor="slate"
      radius="large"
      scaling="100%"
    >
      {children}
    </Theme>
  );
}