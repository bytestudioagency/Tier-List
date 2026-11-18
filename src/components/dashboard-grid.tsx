"use client";

import { Copy, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toaster, toast } from "react-hot-toast";
import { LinkPendingIcon, Spinner } from "@/components/spinner";
import type { TierListData } from "@/types/tier-list";

type Props = {
  tierLists: TierListData[];
};

type BusyAction = "create" | "duplicate" | "share" | "delete";
type Busy = { action: BusyAction; id?: string } | null;

export function DashboardGrid({ tierLists }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();

  const isBusy = (action: BusyAction, id?: string) =>
    busy?.action === action && busy.id === id;

  const visibleLists = tierLists.filter((list) => !removedIds.has(list.id));

  // Keep `busy` set while navigating: the route swaps to the editor skeleton
  // and this component unmounts.
  const openList = (id: string) => {
    startTransition(() => {
      router.push(`/tier-lists/${id}`);
    });
  };

  const createList = async () => {
    setBusy({ action: "create" });
    try {
      const response = await fetch("/api/tier-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Tier List" }),
      });
      if (!response.ok) {
        throw new Error(`Create failed: ${response.status}`);
      }
      const data = await response.json();
      openList(data.tierList.id);
    } catch {
      toast.error("Couldn't create a tier list. Please try again.");
      setBusy(null);
    }
  };

  const deleteList = async (id: string) => {
    setBusy({ action: "delete", id });
    try {
      const response = await fetch(`/api/tier-lists/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }
      setRemovedIds((prev) => new Set(prev).add(id));
      toast.success("Tier list deleted");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Couldn't delete that tier list. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const duplicateList = async (id: string) => {
    setBusy({ action: "duplicate", id });
    try {
      const response = await fetch(`/api/tier-lists/${id}/duplicate`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Duplicate failed: ${response.status}`);
      }
      const data = await response.json();
      openList(data.tierList.id);
    } catch {
      toast.error("Couldn't duplicate that tier list. Please try again.");
      setBusy(null);
    }
  };

  const shareList = async (id: string) => {
    setBusy({ action: "share", id });
    try {
      const response = await fetch(`/api/tier-lists/${id}/share`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Share failed: ${response.status}`);
      }
      const data = await response.json();
      const url = `${window.location.origin}/share/${data.publicSlug}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied to clipboard");
      } catch {
        toast.success(`Share link: ${url}`, { duration: 8000 });
      }
    } catch {
      toast.error("Couldn't create a share link. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
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
      <div className="flex items-center justify-between border-b border-ink-700 pb-4">
        <h1 className="font-display text-3xl text-foreground">
          Your Tier Lists
        </h1>
        <button
          type="button"
          onClick={createList}
          disabled={busy !== null}
          aria-busy={isBusy("create")}
          className="inline-flex cursor-pointer items-center gap-2 bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-accent-ink transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70"
        >
          {isBusy("create") ? <Spinner /> : <Plus className="h-4 w-4" />}
          {isBusy("create") ? "Creating..." : "New Tier List"}
        </button>
      </div>

      {visibleLists.length === 0 ? (
        <div className="border border-dashed border-ink-600 bg-ink-900 p-10 text-center">
          <p className="font-display text-xl text-muted">No tier lists yet</p>
          <p className="mt-1 text-sm text-subtle">
            Create your first one to start ranking.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLists.map((tierList) => (
            <article
              key={tierList.id}
              className="group cursor-pointer border border-ink-700 bg-ink-900 p-4 transition hover:border-accent"
            >
              <h2 className="truncate text-lg font-bold text-foreground">
                {tierList.title}
              </h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-subtle">
                {new Date(tierList.updatedAt).toLocaleString()}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Link
                  href={`/tier-lists/${tierList.id}`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 border border-ink-600 bg-ink-800 px-2.5 py-1.5 font-semibold text-foreground transition hover:border-ink-500 hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <LinkPendingIcon
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    className="h-3.5 w-3.5"
                  />
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => duplicateList(tierList.id)}
                  disabled={busy !== null}
                  aria-busy={isBusy("duplicate", tierList.id)}
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 border border-ink-600 bg-ink-800 px-2.5 py-1.5 font-semibold text-foreground transition hover:border-ink-500 hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60"
                >
                  {isBusy("duplicate", tierList.id) ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => shareList(tierList.id)}
                  disabled={busy !== null}
                  aria-busy={isBusy("share", tierList.id)}
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 bg-accent px-2.5 py-1.5 font-bold text-accent-ink transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong disabled:cursor-wait disabled:opacity-60"
                >
                  {isBusy("share", tierList.id) ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )}
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => deleteList(tierList.id)}
                  disabled={busy !== null}
                  aria-busy={isBusy("delete", tierList.id)}
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 border border-red-900 bg-red-950 px-2.5 py-1.5 font-semibold text-red-300 transition hover:border-red-700 hover:bg-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:cursor-wait disabled:opacity-60"
                >
                  {isBusy("delete", tierList.id) ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
