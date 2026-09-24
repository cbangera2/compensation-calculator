"use client";

import { useEffect, useState } from 'react';

/**
 * useDarkMode — reflects the `.dark` class on <html> (set by ThemeToggle).
 * Observes class changes so ECharts text colors can react to theme switches.
 */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return dark;
}

/**
 * Theme-aware text colors for ECharts (canvas can't read CSS variables).
 * Keep in sync with the oklch palette in globals.css: foreground-ish in
 * dark, zinc-700-ish in light.
 */
export function chartText(dark: boolean) {
  return {
    primary: dark ? '#e5e5e5' : '#3f3f46',
    secondary: dark ? '#a3a3a3' : '#71717a',
  };
}

/** Theme-aware tooltip chrome for ECharts. */
export function chartTooltip(dark: boolean) {
  return {
    backgroundColor: dark ? '#1c1c1e' : '#ffffff',
    borderColor: dark ? '#3f3f46' : '#e4e4e7',
    textStyle: { color: dark ? '#e5e5e5' : '#3f3f46' },
  };
}
