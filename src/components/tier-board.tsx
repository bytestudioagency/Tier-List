"use client";

import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import debounce from "lodash.debounce";
import { Plus } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { DraggableItem } from "@/components/draggable-item";
import { Spinner } from "@/components/spinner";
import { TierRow } from "@/components/tier-row";
import { DEFAULT_TIER_COLORS } from "@/lib/constants";
import type { TierData, TierItem, TierListData } from "@/types/tier-list";

type Props = {
  initial: TierListData;
  readOnly?: boolean;
  onSavingChange?: (isSaving: boolean) => void;
  onManualSaveReady?: (save: () => Promise<void>) => void;
  onChange?: (data: TierListData) => void;
};

type Board = {
  tiers: TierData[];
  poolItems: TierItem[];
};

const POOL_ID = "pool";

const FALLBACK_TIER_COLOR = {
  bgColor: "#3f3f46",
  textColor: "#f4f4f5",
};

function normalizeHexColor(value: string) {
  const withHash = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash : "#3f3f46";
}

function getContrastTextColor(bgColor: string) {
  const hex = normalizeHexColor(bgColor).replace("#", "");
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 140 ? "#2f3440" : "#f4f4f5";
}

function withTierColor(tier: TierData): TierData {
  if (tier.bgColor && tier.textColor) {
    return tier;
  }
  const preset = DEFAULT_TIER_COLORS[tier.name.trim().toUpperCase()];
  return {
    ...tier,
    bgColor: preset?.bgColor ?? FALLBACK_TIER_COLOR.bgColor,
    textColor: preset?.textColor ?? FALLBACK_TIER_COLOR.textColor,
  };
}

function normalize({ tiers, poolItems }: Board): Board {
  return {
    tiers: tiers.map((tier, tierIndex) => ({
      ...tier,
      order: tierIndex,
      items: tier.items.map((item, itemIndex) => ({
        ...item,
        order: itemIndex,
        tierId: tier.id,
      })),
    })),
    poolItems: poolItems.map((item, index) => ({
      ...item,
      order: index,
      tierId: null,
    })),
  };
}

/** Which container ("pool" or a tier id) holds this id. Container ids map to themselves. */
function findContainer(board: Board, id: string): string | null {
  if (id === POOL_ID) {
    return POOL_ID;
  }
  if (board.tiers.some((tier) => tier.id === id)) {
    return id;
  }
  if (board.poolItems.some((item) => item.id === id)) {
    return POOL_ID;
  }
  return (
    board.tiers.find((tier) => tier.items.some((item) => item.id === id))?.id ??
    null
  );
}

function getItems(board: Board, containerId: string): TierItem[] {
  if (containerId === POOL_ID) {
    return board.poolItems;
  }
  return board.tiers.find((tier) => tier.id === containerId)?.items ?? [];
}

function setItems(board: Board, containerId: string, items: TierItem[]): Board {
  if (containerId === POOL_ID) {
    return { ...board, poolItems: items };
  }
  return {
    ...board,
    tiers: board.tiers.map((tier) =>
      tier.id === containerId ? { ...tier, items } : tier,
    ),
  };
}

/** Cheap fingerprint of item placement, used to skip no-op saves. */
function layoutSignature(board: Board) {
  const tiers = board.tiers
    .map((tier) => `${tier.id}:${tier.items.map((item) => item.id).join(",")}`)
    .join("|");
  return `${tiers}|pool:${board.poolItems.map((item) => item.id).join(",")}`;
}

export function TierBoard({
  initial,
  readOnly = false,
  onSavingChange,
  onManualSaveReady,
  onChange,
}: Props) {
  const [title, setTitle] = useState(initial.title);
  const [board, setBoard] = useState<Board>(() => ({
    tiers: [...initial.tiers]
      .sort((a, b) => a.order - b.order)
      .map(withTierColor),
    poolItems: [...initial.poolItems].sort((a, b) => a.order - b.order),
  }));
  const { tiers, poolItems } = board;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  // Latest values for async work (uploads) that resolves after later renders.
  const latest = useRef({ title, board });
  latest.current = { title, board };
  const dragStartBoard = useRef<Board | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 180, tolerance: 6 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(
    ...(readOnly ? [] : [pointerSensor, touchSensor, keyboardSensor]),
  );
  const { setNodeRef: setPoolRef, isOver: isPoolOver } = useDroppable({
    id: POOL_ID,
  });

  const containerIds = useMemo(
    () => new Set([POOL_ID, ...tiers.map((tier) => tier.id)]),
    [tiers],
  );

  // Prefer the item directly under the pointer; fall back to the container
  // under the pointer, then to the nearest droppable (keyboard / edge cases).
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const hits = pointerWithin(args);
      if (hits.length > 0) {
        const itemHit = hits.find((hit) => !containerIds.has(String(hit.id)));
        return [itemHit ?? hits[0]];
      }
      return closestCenter(args);
    },
    [containerIds],
  );

  const allItems = useMemo(
    () => [...poolItems, ...tiers.flatMap((tier) => tier.items)],
    [poolItems, tiers],
  );

  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  useEffect(() => {
    onChange?.({ ...initial, title, ...normalize(board) });
  }, [board, initial, onChange, title]);

  const saveTierList = useCallback(
    async (nextTitle: string, nextBoard: Board) => {
      if (readOnly) {
        return;
      }

      const payload = normalize(nextBoard);
      setIsSaving(true);
      try {
        const response = await fetch(`/api/tier-lists/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: nextTitle,
            tiers: payload.tiers.map((tier) => ({
              id: tier.id,
              name: tier.name,
              bgColor: tier.bgColor ?? FALLBACK_TIER_COLOR.bgColor,
              textColor: tier.textColor ?? FALLBACK_TIER_COLOR.textColor,
              order: tier.order,
            })),
            items: [
              ...payload.poolItems,
              ...payload.tiers.flatMap((tier) => tier.items),
            ].map((item) => ({
              id: item.id,
              imageUrl: item.imageUrl,
              tierId: item.tierId,
              order: item.order,
            })),
          }),
        });
        if (!response.ok) {
          throw new Error(`Save failed with status ${response.status}`);
        }
      } catch {
        toast.error("Couldn't save your changes. Please try again.", {
          id: "save-error",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [initial.id, readOnly],
  );

  const debouncedSave = useMemo(
    () =>
      debounce((nextTitle: string, nextBoard: Board) => {
        void saveTierList(nextTitle, nextBoard);
      }, 550),
    [saveTierList],
  );

  useEffect(() => () => debouncedSave.flush(), [debouncedSave]);

  const manualSave = useCallback(async () => {
    if (readOnly) {
      return;
    }
    debouncedSave.cancel();
    await saveTierList(title, board);
  }, [board, debouncedSave, readOnly, saveTierList, title]);

  useEffect(() => {
    onManualSaveReady?.(manualSave);
  }, [manualSave, onManualSaveReady]);

  const queueSave = (nextTitle: string, nextBoard: Board) => {
    const normalized = normalize(nextBoard);
    setTitle(nextTitle);
    setBoard(normalized);
    debouncedSave(nextTitle, normalized);
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (readOnly) {
      return;
    }
    dragStartBoard.current = board;
    setActiveId(String(event.active.id));
  };

  // Move the item into another container while hovering, so the target row
  // makes room for it live instead of only on drop.
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || readOnly) {
      return;
    }
    const activeKey = String(active.id);
    const overKey = String(over.id);

    setBoard((prev) => {
      const from = findContainer(prev, activeKey);
      const to = findContainer(prev, overKey);
      if (!from || !to || from === to) {
        return prev;
      }

      const fromItems = getItems(prev, from);
      const toItems = getItems(prev, to);
      const fromIndex = fromItems.findIndex((item) => item.id === activeKey);
      if (fromIndex < 0) {
        return prev;
      }

      let insertAt = toItems.length;
      if (!containerIds.has(overKey)) {
        const overIndex = toItems.findIndex((item) => item.id === overKey);
        if (overIndex >= 0) {
          const translated = active.rect.current.translated;
          const pastMiddle =
            translated !== null &&
            translated.left + translated.width / 2 >
              over.rect.left + over.rect.width / 2;
          insertAt = overIndex + (pastMiddle ? 1 : 0);
        }
      }

      const moved = fromItems[fromIndex];
      const nextFrom = fromItems.filter((item) => item.id !== activeKey);
      const nextTo = [
        ...toItems.slice(0, insertAt),
        moved,
        ...toItems.slice(insertAt),
      ];
      return setItems(setItems(prev, from, nextFrom), to, nextTo);
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const startBoard = dragStartBoard.current;
    dragStartBoard.current = null;
    setActiveId(null);
    if (readOnly || !startBoard) {
      return;
    }

    // Dropped outside every container: undo any live cross-row moves.
    if (!over) {
      setBoard(startBoard);
      return;
    }

    const activeKey = String(active.id);
    const overKey = String(over.id);
    let nextBoard = board;

    // Same-container reorder (cross-container moves already happened in dragOver).
    const container = findContainer(board, activeKey);
    if (container && container === findContainer(board, overKey)) {
      const items = getItems(board, container);
      const fromIndex = items.findIndex((item) => item.id === activeKey);
      const toIndex = containerIds.has(overKey)
        ? items.length - 1
        : items.findIndex((item) => item.id === overKey);
      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        nextBoard = setItems(
          board,
          container,
          arrayMove(items, fromIndex, toIndex),
        );
      }
    }

    if (layoutSignature(nextBoard) === layoutSignature(startBoard)) {
      setBoard(startBoard);
      return;
    }
    queueSave(title, nextBoard);
  };

  const handleDragCancel = () => {
    if (dragStartBoard.current) {
      setBoard(dragStartBoard.current);
    }
    dragStartBoard.current = null;
    setActiveId(null);
  };

  const addTier = () => {
    queueSave(title, {
      ...board,
      tiers: [
        ...tiers,
        {
          id: crypto.randomUUID(),
          name: "New",
          order: tiers.length,
          bgColor: FALLBACK_TIER_COLOR.bgColor,
          textColor: FALLBACK_TIER_COLOR.textColor,
          items: [],
        },
      ],
    });
  };

  const removeTier = (tierId: string) => {
    const removedTier = tiers.find((tier) => tier.id === tierId);
    if (!removedTier) {
      return;
    }
    queueSave(title, {
      tiers: tiers.filter((tier) => tier.id !== tierId),
      poolItems: [...poolItems, ...removedTier.items],
    });
  };

  const renameTier = (tierId: string, name: string) => {
    queueSave(title, {
      ...board,
      tiers: tiers.map((tier) =>
        tier.id === tierId ? { ...tier, name } : tier,
      ),
    });
  };

  const changeTierColor = (tierId: string, bgColor: string) => {
    const normalizedBgColor = normalizeHexColor(bgColor);
    queueSave(title, {
      ...board,
      tiers: tiers.map((tier) =>
        tier.id === tierId
          ? {
              ...tier,
              bgColor: normalizedBgColor,
              textColor: getContrastTextColor(normalizedBgColor),
            }
          : tier,
      ),
    });
  };

  const onTitleBlur = () => {
    queueSave(title, board);
  };

  const uploadImages = async (files: File[]) => {
    if (files.length === 0 || readOnly) {
      return;
    }

    const form = new FormData();
    for (const file of files) {
      form.append("file", file);
    }

    let urls: string[] = [];
    setUploadingCount((count) => count + files.length);
    try {
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const body = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) {
        toast.error(body.error ?? "Upload failed. Please try again.");
        return;
      }
      urls = (body.urls ?? []) as string[];
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
      return;
    } finally {
      setUploadingCount((count) => count - files.length);
    }

    if (urls.length < files.length) {
      toast.error(
        `${files.length - urls.length} of ${files.length} images failed to upload.`,
      );
    }
    if (urls.length === 0) {
      return;
    }

    // Use the board as it is now, not when the upload started, so moves made
    // while uploading aren't overwritten.
    const current = latest.current;
    queueSave(current.title, {
      ...current.board,
      poolItems: [
        ...current.board.poolItems,
        ...urls.map((imageUrl, index) => ({
          id: crypto.randomUUID(),
          imageUrl,
          order: current.board.poolItems.length + index,
          tierId: null,
        })),
      ],
    });
  };

  const activeItem = activeId
    ? allItems.find((item) => item.id === activeId)
    : undefined;

  return (
    <div className="space-y-4">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--ink-800)",
            color: "var(--foreground)",
            border: "1px solid var(--ink-600)",
            borderRadius: 0,
            fontWeight: 600,
          },
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <input
          disabled={readOnly}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={onTitleBlur}
          className="font-display min-w-[260px] flex-1 border border-ink-600 bg-ink-900 px-4 py-2 text-xl text-foreground outline-none focus:border-accent disabled:opacity-80"
        />
        {!readOnly && (
          <button
            type="button"
            onClick={addTier}
            className="cursor-pointer bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-[0.08em] text-accent-ink transition hover:bg-accent-strong"
          >
            Add Tier
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="space-y-3">
          {tiers.map((tier) => (
            <TierRow
              key={tier.id}
              tier={tier}
              onTierNameChange={renameTier}
              onTierColorChange={changeTierColor}
              onRemoveTier={removeTier}
              removable={!readOnly && tiers.length > 1}
              readOnly={readOnly}
            />
          ))}
        </div>

        <div className="mt-6 border border-ink-700 bg-ink-900 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">
            Image Pool
          </p>
          <SortableContext
            items={poolItems.map((item) => item.id)}
            strategy={rectSortingStrategy}
          >
            <div
              id={POOL_ID}
              ref={setPoolRef}
              className={`flex min-h-24 flex-wrap gap-2 p-1 transition-colors ${isPoolOver ? "bg-ink-800" : ""}`}
            >
              {poolItems.map((item) => (
                <DraggableItem
                  key={item.id}
                  id={item.id}
                  imageUrl={item.imageUrl}
                  disabled={readOnly}
                />
              ))}
              {Array.from({ length: uploadingCount }, (_, index) => (
                <output
                  // biome-ignore lint/suspicious/noArrayIndexKey: transient placeholders
                  key={index}
                  className="flex h-22 w-22 animate-pulse items-center justify-center border border-ink-700 bg-ink-800 text-muted"
                >
                  <Spinner className="h-5 w-5" />
                  <span className="sr-only">Uploading image</span>
                </output>
              ))}
              {!readOnly && (
                <label className="flex h-22 w-22 cursor-pointer items-center justify-center border border-dashed border-accent-dim bg-accent/10 text-accent transition hover:border-accent hover:bg-accent/20">
                  <Plus className="h-6 w-6" />
                  <span className="sr-only">Upload images</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                    multiple
                    onChange={(event) => {
                      // Copy before clearing so the same file can be picked again.
                      const picked = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      void uploadImages(picked);
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </SortableContext>
        </div>

        <DragOverlay>
          {activeItem ? (
            <div className="relative h-22 w-22 cursor-grabbing overflow-hidden border border-accent bg-ink-900 shadow-lg shadow-black/60">
              <Image
                src={activeItem.imageUrl}
                alt="Dragging item"
                fill
                className="object-cover"
                sizes="88px"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
