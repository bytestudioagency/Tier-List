"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import Image from "next/image";

type Props = {
  id: string;
  imageUrl: string;
  disabled?: boolean;
};

export function DraggableItem({ id, imageUrl, disabled = false }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={clsx(
        "relative h-22 w-22 overflow-hidden border bg-ink-900 transition-colors",
        // The DragOverlay follows the pointer; the original stays as a dim placeholder.
        isDragging ? "border-accent opacity-30" : "border-ink-700",
        !disabled &&
          "cursor-grab touch-none select-none hover:border-ink-500 active:cursor-grabbing",
      )}
      {...attributes}
      {...listeners}
    >
      <Image
        src={imageUrl}
        alt="Tier item"
        fill
        draggable={false}
        className="pointer-events-none object-cover"
        sizes="88px"
      />
    </button>
  );
}
