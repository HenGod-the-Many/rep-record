/**
 * Built-in body metrics (W-11). Their ids are fixed so the first-launch seed,
 * the version-4 upgrade and a restored backup all agree on them.
 * Bodyweight and height are always on; the rest start off.
 */
export type MetricKind = 'weight' | 'length' | 'percent' | 'custom' | 'photos';

export interface BuiltInMetric {
  id: string;
  name: string;
  kind: MetricKind;
  alwaysOn: boolean;
}

export const BUILT_IN_METRICS: BuiltInMetric[] = [
  { id: 'bodyweight', name: 'Bodyweight', kind: 'weight', alwaysOn: true },
  { id: 'height', name: 'Height', kind: 'length', alwaysOn: true },
  { id: 'waist', name: 'Waist', kind: 'length', alwaysOn: false },
  { id: 'chest', name: 'Chest', kind: 'length', alwaysOn: false },
  { id: 'hips', name: 'Hips', kind: 'length', alwaysOn: false },
  { id: 'upper-arm', name: 'Upper arm', kind: 'length', alwaysOn: false },
  { id: 'thigh', name: 'Thigh', kind: 'length', alwaysOn: false },
  { id: 'neck', name: 'Neck', kind: 'length', alwaysOn: false },
  { id: 'calf', name: 'Calf', kind: 'length', alwaysOn: false },
  { id: 'body-fat', name: 'Body fat', kind: 'percent', alwaysOn: false },
  { id: 'photos', name: 'Progress photos', kind: 'photos', alwaysOn: false },
];

/** Row shape for a built-in, in list order. */
export function builtInRows() {
  return BUILT_IN_METRICS.map((m, order) => ({
    id: m.id,
    name: m.name,
    kind: m.kind,
    unit: '',
    builtIn: true,
    alwaysOn: m.alwaysOn,
    enabled: m.alwaysOn,
    order,
  }));
}
