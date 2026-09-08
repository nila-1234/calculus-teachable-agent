"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasSubjectId } from "@/lib/subject";

/**
 * Routes reachable without a subject ID: the welcome page (where the study
 * starts), the surveys (where the ID is entered), and the instructor tooling
 * (researcher-only, not part of a participant run).
 */
const EXEMPT = [/^\/$/, /^\/survey(\/|$)/, /^\/instructor(\/|$)/];

/**
 * Keeps participants from reaching a logged step before they have an ID.
 * Landing on /scenarios or a test directly used to work fine and tag every
 * event "unknown", which is unrecoverable after the fact.
 */
export default function SubjectGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    if (EXEMPT.some((pattern) => pattern.test(pathname))) return;
    if (hasSubjectId()) return;

    const query = window.location.search;
    router.replace(query ? `/survey/pre${query}` : "/survey/pre");
  }, [pathname, router]);

  return null;
}
