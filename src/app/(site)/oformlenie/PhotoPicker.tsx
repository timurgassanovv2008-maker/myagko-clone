"use client";

import { useRef } from "react";
import { MAX_PHOTOS } from "@/lib/order";
import { ACCEPTED_TYPES } from "@/lib/client/images";
import styles from "./checkout.module.css";

export type Photo = {
  key: string;
  status: "preparing" | "uploading" | "done" | "error";
  thumb?: string;
  id?: string;
  error?: string;
  blob?: Blob;
};

type Props = {
  photos: Photo[];
  required: boolean;
  error?: string;
  onAdd: (files: File[]) => void;
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
};

export function PhotoPicker({ photos, required, error, onAdd, onRetry, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const left = MAX_PHOTOS - photos.length;

  return (
    <div className="field">
      <span className="label" id="photos-label">
        Фото мебели{" "}
        <span className="hint">
          {required ? "обязательно для «Другое»" : "необязательно"}, до {MAX_PHOTOS} шт., JPEG, PNG или WebP
        </span>
      </span>
      <div className={styles.photos} role="group" aria-labelledby="photos-label">
        {photos.map((p) => (
          <div key={p.key} className={styles.photo} data-status={p.status}>
            {p.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- превью из памяти браузера
              <img src={p.thumb} alt="" className={styles.photoImg} />
            ) : (
              <div className={styles.photoImg} />
            )}
            {(p.status === "uploading" || p.status === "preparing") && (
              <span className={styles.photoState}>
                <span className="spinner" aria-hidden="true" />
                <span className="visually-hidden">Загружается</span>
              </span>
            )}
            {p.status === "error" && (
              <span className={styles.photoError}>
                <span>{p.error}</span>
                {p.blob && (
                  <button type="button" className={styles.photoRetry} onClick={() => onRetry(p.key)}>
                    Повторить
                  </button>
                )}
              </span>
            )}
            <button type="button" className={styles.photoRemove} onClick={() => onRemove(p.key)} aria-label="Удалить фото">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
        {left > 0 && (
          <button
            type="button"
            className={styles.photoAdd}
            onClick={() => input.current?.click()}
            aria-describedby={error ? "photos-error" : undefined}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Добавить фото</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, left);
          e.target.value = "";
          if (files.length) onAdd(files);
        }}
      />
      {error && (
        <span className="error" id="photos-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
