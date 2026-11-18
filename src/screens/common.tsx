import type { ReactNode } from 'react';
import { navigate } from '../router';
import { ValidationError } from '../db/errors';

export function Header(props: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="header">
      {props.back ? (
        <button className="header-back" onClick={() => navigate(props.back!)} aria-label="Back">
          ‹ Back
        </button>
      ) : (
        <span />
      )}
      <h1>{props.title}</h1>
      <div className="header-action">{props.action}</div>
    </header>
  );
}

/** Run an action and turn a ValidationError into a message; rethrow anything else. */
export async function attempt(fn: () => Promise<unknown>, setError: (m: string | null) => void): Promise<boolean> {
  try {
    await fn();
    setError(null);
    return true;
  } catch (e) {
    if (e instanceof ValidationError) {
      setError(e.message);
      return false;
    }
    setError(`Something went wrong: ${String(e)}`);
    return false;
  }
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? (
    <p className="error" role="alert">
      {message}
    </p>
  ) : null;
}
