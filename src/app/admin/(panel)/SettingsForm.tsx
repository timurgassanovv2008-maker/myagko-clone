"use client";

import { startTransition, useActionState } from "react";
import type { ActionState } from "../actions";
import styles from "../admin.module.css";

export type Field = {
  name: string;
  label: string;
  hint?: string;
  defaultValue: string;
  type?: "text" | "number" | "tel" | "email" | "color";
  suffix?: string;
  placeholder?: string;
};

/** Простая форма настроек: поля, ошибки рядом, сообщение о сохранении. */
export function SettingsForm({
  action: serverAction,
  groups,
  submitLabel = "Сохранить",
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  groups: { title: string; note?: string; fields: Field[] }[];
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(serverAction, {});
  const e = state.errors ?? {};
  // ошибки прайса приходят с путём вида variants.sofa-2
  const errFor = (name: string) => e[name] ?? e[name.replace(/^variant\./, "variants.")];
  return (
    // Отправка вручную, а не через <form action>: React сбрасывает поля после action,
    // а при ошибке введённое должно остаться на месте.
    <form
      className={styles.form}
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {groups.map((g) => (
        <section key={g.title} className={`card ${styles.block}`}>
          <h2 className={styles.h2}>{g.title}</h2>
          {g.note && <p className="hint">{g.note}</p>}
          <div className={styles.fieldGrid}>
            {g.fields.map((f) => {
              const err = errFor(f.name);
              const id = `s-${f.name}`;
              return (
                <div key={f.name} className="field">
                  <label className="label" htmlFor={id}>
                    {f.label}
                  </label>
                  <div className={styles.inputWrap}>
                    <input
                      id={id}
                      name={f.name}
                      className="input"
                      type={f.type === "number" ? "text" : (f.type ?? "text")}
                      inputMode={f.type === "number" ? "numeric" : undefined}
                      defaultValue={f.defaultValue}
                      placeholder={f.placeholder}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={err ? `${id}-error` : f.hint ? `${id}-hint` : undefined}
                    />
                    {f.suffix && <span className={styles.suffix}>{f.suffix}</span>}
                  </div>
                  {err ? (
                    <span className="error" id={`${id}-error`}>
                      {err}
                    </span>
                  ) : (
                    f.hint && (
                      <span className="hint" id={`${id}-hint`}>
                        {f.hint}
                      </span>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className={styles.saveBar}>
        {state.message && (
          <span className={state.ok ? styles.saved : "error"} role="status">
            {state.message}
          </span>
        )}
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Сохраняем…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
