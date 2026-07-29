import type { ReactNode } from 'react';
import { useTheme, type Theme } from '../lib/theme.js';

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 15,
  height: 15,
};

const OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
  },
];

/** Three-way light/system/dark switcher — persists to localStorage via useTheme(). */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={theme === opt.value}
          title={opt.label}
          className={`theme-toggle-btn${theme === opt.value ? ' active' : ''}`}
          onClick={() => setTheme(opt.value)}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
