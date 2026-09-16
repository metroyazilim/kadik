"use client";

import { cn } from "./ui";

export type SettingsCategoryItem<Key extends string = string> = Readonly<{
  key: Key;
  label: string;
  description: string;
}>;

type SettingsCategoryNavProps<Key extends string> = Readonly<{
  items: readonly SettingsCategoryItem<Key>[];
  activeKey: Key;
  onChange: (key: Key) => void;
  label: string;
}>;

/** Category navigator for settings hub screens. */
export function SettingsCategoryNav<Key extends string>({ items, activeKey, onChange, label }: SettingsCategoryNavProps<Key>) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold uppercase tracking-wider text-brand-muted md:hidden" htmlFor={`${label}-select`}>
        Bölüm seçin
      </label>
      <select
        id={`${label}-select`}
        className="block w-full rounded-[var(--radius-sm)] border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text md:hidden"
        value={activeKey}
        onChange={(event) => onChange(event.target.value as Key)}
      >
        {items.map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>
      <nav aria-label={label} className="hidden rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-2 md:block">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = item.key === activeKey;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onChange(item.key)}
                  className={cn(
                    "w-full rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition-colors",
                    active ? "bg-brand-muted-surface text-brand-text" : "text-brand-muted hover:bg-brand-page hover:text-brand-text",
                  )}
                >
                  <span className="block text-xs font-bold uppercase tracking-wider">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5">{item.description}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
