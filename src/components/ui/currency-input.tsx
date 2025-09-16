"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";

type Props = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: number | undefined;
  onValueChange: (v: number) => void;
  decimals?: number;
};

export function CurrencyInput({ value, onValueChange, className, decimals = 0, onBlur, onFocus, ...rest }: Props) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState<string>("");

  // Sync displayed text from value when not editing
  React.useEffect(() => {
    if (!editing) setText(formatCurrency(value ?? 0, { decimals }));
  }, [value, editing, decimals]);

  const parse = (s: string) => {
    // remove $ and commas and spaces
    const cleaned = s.replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setEditing(true);
    setText((value ?? 0).toString());
    onFocus?.(e);
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setEditing(false);
    // Commit 0 if empty
    if (text.trim() === "") onValueChange(0);
    onBlur?.(e);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setText(next);
    const parsed = parse(next);
    if (!Number.isNaN(parsed)) onValueChange(parsed);
  };

  return (
    <Input
      {...rest}
      type="text"
  className={cn("min-w-0", className)}
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      inputMode="decimal"
    />
  );
}

export default CurrencyInput;
