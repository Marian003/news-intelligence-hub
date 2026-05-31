/**
 * Preset axes seeded for every new user. They are ordinary rows once created —
 * the user can rename, extend, or delete any of them and add their own.
 */
export const PRESET_AXES: ReadonlyArray<{name: string; values: string[]}> = [
  {
    name: 'Content Type',
    values: ['news', 'analysis', 'opinion', 'tutorial', 'announcement'],
  },
  {name: 'Reader Level', values: ['beginner', 'intermediate', 'expert']},
  {
    name: 'Region',
    values: ['global', 'north america', 'europe', 'asia', 'other'],
  },
  {name: 'Tone', values: ['neutral', 'positive', 'negative', 'critical']},
];
