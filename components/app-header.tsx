"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Flex, Text } from "@radix-ui/themes";

export default function AppHeader() {
  const pathname = usePathname();
  const isInstructor = pathname === "/instructor" || pathname.startsWith("/instructor/");

  return (
    <Flex
      align="center"
      justify="between"
      gap="3"
      className="border-b border-stone-200 bg-white px-4 py-3 sm:px-6"
    >
      <Flex align="center" gap="2" className="min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-600 text-white">
          <span className="text-sm font-bold">A</span>
        </div>
        <Text
          size="3"
          weight="bold"
          className="hidden truncate text-stone-800 sm:block"
        >
          <Link href="/scenarios">Teachable Calculus Agent</Link>
        </Text>
      </Flex>

      <Flex align="center" gap="3" className="shrink-0">
        <nav
          aria-label="Choose workspace"
          className="inline-flex rounded-xl border border-stone-200 bg-stone-100 p-1"
        >
          <Link
            href="/"
            aria-current={!isInstructor ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-600 sm:text-sm ${
              !isInstructor
                ? "bg-white text-stone-800 shadow-sm"
                : "text-stone-500 hover:bg-white/70 hover:text-stone-700"
            }`}
          >
            Student
          </Link>
          <Link
            href="/instructor"
            aria-current={isInstructor ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-600 sm:text-sm ${
              isInstructor
                ? "bg-lime-600 text-white shadow-sm"
                : "text-stone-500 hover:bg-white/70 hover:text-stone-700"
            }`}
          >
            Instructor
          </Link>
        </nav>

        <Avatar
          fallback={isInstructor ? "TA" : "S"}
          radius="full"
          size="2"
          color={isInstructor ? "lime" : "gray"}
          variant="soft"
        />
      </Flex>
    </Flex>
  );
}
