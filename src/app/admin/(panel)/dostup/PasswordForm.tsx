"use client";

import { useActionState } from "react";
import { changePasswordAction, type ActionState } from "../../actions";
import styles from "../../admin.module.css";

const FIELDS = [
  { name: "current", label: "Текущий пароль", auto: "current-password" },
  { name: "next", label: "Новый пароль", auto: "new-password", hint: "Не короче 10 символов" },
  { name: "repeat", label: "Новый пароль ещё раз", auto: "new-password" },
];

export function PasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(changePasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className={styles.form} key={state.ok ? "done" : "form"}>
      {FIELDS.map((f) => (
        <div className="field" key={f.name}>
          <label className="label" htmlFor={`p-${f.name}`}>
            {f.label}
          </label>
          <input
            id={`p-${f.name}`}
            name={f.name}
            type="password"
            className="input"
            autoComplete={f.auto}
            aria-invalid={e[f.name] ? true : undefined}
            aria-describedby={e[f.name] ? `p-${f.name}-error` : undefined}
          />
          {e[f.name] ? (
            <span className="error" id={`p-${f.name}-error`}>
              {e[f.name]}
            </span>
          ) : (
            f.hint && <span className="hint">{f.hint}</span>
          )}
        </div>
      ))}
      {state.message && (
        <p className={`notice ${state.ok ? "" : "notice-danger"}`} role="status">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Меняем…" : "Сменить пароль"}
      </button>
    </form>
  );
}
