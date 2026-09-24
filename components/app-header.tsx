"use client";

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
        {/* Same file as the favicon (app/icon.svg), which Next serves at /icon.svg. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="h-8 w-8 shrink-0" />
        <Text
          size="3"
          weight="bold"
          className="hidden truncate text-stone-800 sm:block"
        >
          {/* Not a link: /scenarios now routes into the study, so clicking
              the logo mid-run would jump the participant out of their step. */}
          Teachable Calculus Agent
        </Text>
      </Flex>

      {/*
        No workspace toggle: the instructor view is reached by its own link, so
        surfacing it here would put it one click away for every participant.
      */}
      <Flex align="center" gap="3" className="shrink-0">
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
