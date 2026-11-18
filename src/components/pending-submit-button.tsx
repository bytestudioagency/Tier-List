"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/spinner";

type Props = Omit<React.ComponentProps<"button">, "type"> & {
  pendingLabel: string;
};

/** Submit button that disables itself and shows a spinner while its form action runs. */
export function PendingSubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  ...rest
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      {...rest}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={`inline-flex items-center gap-2 disabled:cursor-wait disabled:opacity-80 ${className ?? ""}`}
    >
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </button>
  );
}
