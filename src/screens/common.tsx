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

/** What the logging screen hands each exercise card (W-17): move it in this workout, fold it. */
export interface SlotControls {
  /** Undefined when it can't move that way (first or last). */
  moveUp?: () => void;
  moveDown?: () => void;
  /** Present when the card can fold (every target set logged): tapping the title folds it. */
  onFold?: () => void;
  /** Called when a set of a finished exercise is rated, to fold it. */
  onComplete?: () => void;
}

/** ▲ ▼ for putting an exercise where it was really done. This workout only. */
export function MoveButtons({ name, controls }: { name: string; controls?: SlotControls }) {
  if (!controls) return null;
  return (
    <span className="move-btns">
      <button className="icon-btn" aria-label={`Move ${name} up`} disabled={!controls.moveUp} onClick={controls.moveUp}>▲</button>
      <button className="icon-btn" aria-label={`Move ${name} down`} disabled={!controls.moveDown} onClick={controls.moveDown}>▼</button>
    </span>
  );
}

/** The card's title; once the exercise is done, tapping it folds the card. */
export function CardTitle({ name, controls, children }: { name: string; controls?: SlotControls; children?: ReactNode }) {
  if (controls?.onFold) {
    return (
      <button className="card-title fold-head" aria-expanded={true} aria-label={`${name}: fold`} onClick={controls.onFold}>
        {name}
        {children}
        <span className="fold-mark" aria-hidden="true">▴</span>
      </button>
    );
  }
  return (
    <div className="card-title">
      {name}
      {children}
    </div>
  );
}
