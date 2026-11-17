"use client";

import type { ReactNode } from "react";
import type { CategoryId } from "@/lib/pricing/catalog";
import { requestCategory } from "./events";

/** Ссылка из карточки услуги: выбирает категорию в конфигураторе и прокручивает к нему. */
export function PickCategory({ category, className, children }: { category: CategoryId; className?: string; children: ReactNode }) {
  return (
    <a href="#raschet" className={className} onClick={() => requestCategory(category)}>
      {children}
    </a>
  );
}
