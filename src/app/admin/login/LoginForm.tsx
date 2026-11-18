"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, {});
  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <div className="field">
        <label className="label" htmlFor="password">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={state.message ? true : undefined}
          aria-describedby={state.message ? "login-error" : undefined}
        />
        {state.message && (
          <span className="error" id="login-error" role="alert">
            {state.message}
          </span>
        )}
      </div>
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
