"use client";

import clsx from "clsx";
import { LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={clsx("h-4 w-4 shrink-0 animate-spin", className)}
    />
  );
}

/**
 * Drop inside a <Link>: swaps the given icon for a spinner while that link's
 * navigation is pending.
 */
export function LinkPendingIcon({
  icon,
  className,
}: {
  icon: React.ReactNode;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className={className} /> : icon;
}
