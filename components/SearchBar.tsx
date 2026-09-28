"use client";

import { IconSearch, IconClose } from "./icons";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChange, placeholder = "Search items or categories" }: Props) {
  return (
    <div className="sticky top-0 z-20 h-14 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur">
      <div className="relative flex h-full items-center">
        <IconSearch className="pointer-events-none absolute left-3 text-subtle" width={18} height={18} />
        <input
          type="search"
          inputMode="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-9 text-[15px] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2 rounded-full p-1 text-subtle transition hover:text-muted"
          >
            <IconClose width={16} height={16} />
          </button>
        )}
      </div>
    </div>
  );
}
