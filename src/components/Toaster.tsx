"use client";

import { hideToast, useToast } from "@/lib/client/toast";
import styles from "./Toaster.module.css";

export function Toaster() {
  const toast = useToast();
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toast && (
        <div className={styles.toast} key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.action!.run();
                hideToast();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
