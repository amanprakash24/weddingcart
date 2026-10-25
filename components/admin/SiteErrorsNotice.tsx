'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// On the admin Today page: "3 site errors need a look" when problems happened on the site in the last 7 days and are not
// marked fixed (/admin/errors). Shows nothing otherwise, or if the number cannot be loaded.
export default function SiteErrorsNotice() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/site-errors?summary=1')
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.success) setCount(d.data.recentOpen);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (count === 0) return null;
  return (
    <Link
      href="/admin/errors"
      className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 hover:bg-red-100"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-bold text-white">{count}</span>
        <span className="font-semibold">{count === 1 ? 'A site error needs a look' : `${count} site errors need a look`}</span>
      </span>
      <span className="font-semibold">Open →</span>
    </Link>
  );
}
