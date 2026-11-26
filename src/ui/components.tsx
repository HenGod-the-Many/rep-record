import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import './ui.css';

/**
 * Plate components (design system section 6). Built once here and reused;
 * screens don't restyle them.
 */

/** Top-level screen title: a small context line, then the big upper-case title. */
export function LargeTitle({ context, title, action }: { context?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <header className="ui-large-title">
      <div>
        {context && <p className="ui-context">{context}</p>}
        <h1>{title}</h1>
      </div>
      {action && <div className="ui-title-action">{action}</div>}
    </header>
  );
}

/** The one "do this now" card per screen. */
export function HeroCard({ context, name, facts, children }: { context?: ReactNode; name: string; facts?: ReactNode; children?: ReactNode }) {
  return (
    <section className="ui-hero" aria-label={name}>
      {context && <p className="ui-hero-context">{context}</p>}
      <h2 className="ui-hero-name">{name}</h2>
      {facts && <p className="ui-hero-facts">{facts}</p>}
      {children}
    </section>
  );
}

/** The screen's one accent-filled button. */
export function MainAction({ icon = 'play', children, onClick, disabled }: { icon?: IconName; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="ui-main-action" onClick={onClick} disabled={disabled}>
      <Icon name={icon} strong />
      <span>{children}</span>
    </button>
  );
}

export function SecondaryButton({ children, onClick, icon, disabled }: { children: ReactNode; onClick: () => void; icon?: IconName; disabled?: boolean }) {
  return (
    <button className="ui-secondary" onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={20} />}
      <span>{children}</span>
    </button>
  );
}

export function TextButton({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button className={danger ? 'ui-text-btn danger' : 'ui-text-btn'} onClick={onClick}>
      {children}
    </button>
  );
}

/** A button that shows only an icon; the label is for VoiceOver. */
export function IconButton({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="ui-icon-btn" aria-label={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
    </button>
  );
}

export interface Stat {
  value: ReactNode;
  caption: string;
  onClick?: () => void;
}

/** Three big numbers in a row; each taps through to its detail. */
export function StatStrip({ label, stats }: { label?: string; stats: Stat[] }) {
  return (
    <section className="ui-stat-strip-wrap" aria-label={label}>
      {label && <h2 className="ui-section-label">{label}</h2>}
      <div className="ui-stat-strip">
        {stats.map((s) => {
          const inner = (
            <>
              <span className="ui-big-number">{s.value}</span>
              <span className="ui-caption">{s.caption}</span>
            </>
          );
          return s.onClick ? (
            <button key={s.caption} className="ui-stat" onClick={s.onClick}>{inner}</button>
          ) : (
            <div key={s.caption} className="ui-stat">{inner}</div>
          );
        })}
      </div>
    </section>
  );
}

/** N equal segments, `filled` of them in accent. */
export function SegmentBar({ total, filled, label }: { total: number; filled: number; label: string }) {
  const n = Math.max(1, Math.min(total, 12));
  const f = Math.max(0, Math.min(filled, n));
  return (
    <div className="ui-segment-bar" role="img" aria-label={label}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={i < f ? 'on' : ''} />
      ))}
    </div>
  );
}

/** A trend tile; the whole tile is a button when it has an action. */
export function MetricTile({ label, value, unit, caption, children, onClick }: {
  label: string; value: ReactNode; unit?: string; caption?: ReactNode; children?: ReactNode; onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="ui-tile-label">{label}</span>
      <span className="ui-tile-number">
        {value}
        {unit && <small> {unit}</small>}
      </span>
      {caption && <span className="ui-caption">{caption}</span>}
      {children}
    </>
  );
  return onClick ? (
    <button className="ui-tile" onClick={onClick}>{inner}</button>
  ) : (
    <div className="ui-tile">{inner}</div>
  );
}

/** A list row at least 56 tall: title, optional caption, value or chevron at the right. */
export function ListRow({ title, caption, value, onClick }: { title: ReactNode; caption?: ReactNode; value?: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span className="ui-row-text">
        <span className="ui-row-title">{title}</span>
        {caption && <span className="ui-caption">{caption}</span>}
      </span>
      {value !== undefined ? <span className="ui-row-value">{value}</span> : onClick && <Icon name="chevron-right" size={20} className="ui-row-chevron" />}
    </>
  );
  return onClick ? (
    <button className="ui-row" onClick={onClick}>{inner}</button>
  ) : (
    <div className="ui-row">{inner}</div>
  );
}

/** A 2-4 way switch, e.g. Library's Programs · Workouts · Exercises · Warm-ups. */
export function SegmentedSwitch<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="ui-switch" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** "…" menu for rare and risky actions. Closes on choice, outside tap or Escape. */
export function MoreMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLButtonElement>('.ui-menu button:not(:disabled)')?.focus();
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="ui-more" ref={box}>
      <button ref={trigger} className="ui-icon-btn" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Icon name="more" />
      </button>
      {open && (
        <ul className="ui-menu" id={id}>
          {items.map((it) => (
            <li key={it.label}>
              <button
                className={it.danger ? 'danger' : ''}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
