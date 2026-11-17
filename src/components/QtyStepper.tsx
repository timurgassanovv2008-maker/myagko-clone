"use client";

import { MAX_QTY } from "@/lib/pricing/calc";
import styles from "./QtyStepper.module.css";

type Props = { value: number; onChange: (n: number) => void; label?: string; size?: "md" | "sm" };

export function QtyStepper({ value, onChange, label = "Количество", size = "md" }: Props) {
  return (
    <div className={`${styles.stepper} ${size === "sm" ? styles.sm : ""}`} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Меньше"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <output className={`${styles.value} tabular`} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={styles.btn}
        onClick={() => onChange(Math.min(MAX_QTY, value + 1))}
        disabled={value >= MAX_QTY}
        aria-label="Больше"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
