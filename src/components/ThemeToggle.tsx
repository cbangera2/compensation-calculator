"use client";

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'compcalc-theme';

function initialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * ThemeToggle — class-based dark mode switch.
 *
 * Toggles `.dark` on <html>, persists the choice to localStorage, and falls
 * back to prefers-color-scheme on first load. Renders a placeholder until
 * mounted so the server render never mismatches.
 */
export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    setTheme(initialTheme());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  if (!mounted) {
    // Placeholder keeps layout stable and avoids hydration mismatch.
    return <span className="size-10 shrink-0" aria-hidden="true" />;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 shrink-0 rounded-full"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
