/**
 * The one icon set (design system section 4): inline stroke SVG, 24 x 24,
 * 1.8 stroke (2 when `strong`), round caps, currentColor. Decorative by
 * default (aria-hidden): the button around an icon carries the label.
 */
export type IconName =
  | 'home' | 'calendar' | 'library' | 'progress' | 'gear' | 'play' | 'plus' | 'minus' | 'check'
  | 'more' | 'chevron-right' | 'chevron-left' | 'bin' | 'arrow-up' | 'arrow-down' | 'drag' | 'search' | 'close' | 'pause';

const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M10 20v-6h4v6',
  calendar: 'M4 6.5h16V20H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
  library: 'M5 4h3.5v16H5zM10.5 4H14v16h-3.5zM15.8 5.2l3.3-.9 3.4 15.4-3.3.9z',
  progress: 'M4 20h16M6.5 20v-6M11 20V9M15.5 20v-9M20 20V5',
  gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7.4 7.4 0 0 1-2 1.2L15 20.3h-3.6l-.3-2a7.4 7.4 0 0 1-2-1.2l-1.9.7-1.8-3.1 1.6-1.2a7.6 7.6 0 0 1 0-2.4L5.4 9.9l1.8-3.1 1.9.7a7.4 7.4 0 0 1 2-1.2l.3-2H15l.3 2a7.4 7.4 0 0 1 2 1.2l1.9-.7 1.8 3.1-1.6 1.2a7.6 7.6 0 0 1 0 2.4z',
  play: 'M7 4.5v15l12.5-7.5z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M4.5 12.5l5 5 10-11',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  'chevron-right': 'M9 5l7 7-7 7',
  'chevron-left': 'M15 5l-7 7 7 7',
  bin: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
  'arrow-up': 'M12 19V5M6 11l6-6 6 6',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  close: 'M6 6l12 12M18 6 6 18',
  pause: 'M8.5 5v14M15.5 5v14',
};

/** Dots read better as round dots with a heavier stroke. */
const DOTS: Partial<Record<IconName, true>> = { more: true, drag: true };

export function Icon({ name, size = 24, strong = false, className }: { name: IconName; size?: number; strong?: boolean; className?: string }) {
  const width = DOTS[name] ? 3 : strong ? 2 : 1.8;
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
