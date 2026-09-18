"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useCollection } from "@/components/CollectionProvider";
import { Icon } from "./Icon";

export function ProfileOwnerIsland({
  handle,
  name,
}: {
  handle: string;
  name: string;
}) {
  const { userId } = useCollection();
  const [ownHandle, setOwnHandle] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void import("@/lib/auth/browser").then(async ({ createAuthBrowserClient }) => {
      const supabase = createAuthBrowserClient();
      const { data } = await supabase.from("profiles").select("handle").eq("id", userId).maybeSingle();
      if (!cancelled) setOwnHandle(data?.handle ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const own = Boolean(userId && ownHandle === handle);

  if (own) {
    return (
      <>
        <p className="page-subtitle mt-6 max-w-xl">
          This is your public page. Saved dates stay with your account. Collections you publish appear here.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/collections/new" className="button-primary">
            New collection <Icon name="arrow" />
          </Link>
          <Link href="/saved" className="button-secondary">
            Your space
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="page-subtitle mt-6 max-w-xl">
        {name} is counting down on Until. Public collections appear below.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/create" className="button-secondary">
          <Icon name="plus" /> Make your own
        </Link>
      </div>
    </>
  );
}
