// The palette and type scale from docs/marca/README.md; change both together.

export const colors = {
  orchid50: '#FBF3F8',
  orchid100: '#F4E1EE',
  orchid200: '#E8C3DC',
  orchid700: '#9C4A85',
  orchid800: '#7E3369',
  orchid900: '#4E1F41',
  leaf50: '#F2F8EE',
  leaf200: '#CDE5C0',
  leaf700: '#3F7A2A',
  leaf800: '#2F6420',
  leaf900: '#1E4214',
  amber50: '#FFF3E0',
  amber800: '#8A4B00',
  red50: '#FCE8E6',
  red700: '#B3261E',
  ink: '#1F1A1E',
  graphite: '#4A4248',
  outline: '#8C838A',
  divider: '#E6DFE4',
  surface: '#F8F5F7',
  white: '#FFFFFF',
};

export const fonts = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
};

export const text = {
  screen: { fontSize: 26, lineHeight: 32 },
  title: { fontSize: 20, lineHeight: 26 },
  button: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 17, lineHeight: 24 },
  support: { fontSize: 16, lineHeight: 22 },
};

// How far the system font grows each one. Screen titles and titles stop early, so a large system font doesn't break
// them across lines; body text grows without limit.
export const maxFontScale = { tab: 1.15, chip: 1.3, screen: 1.5, title: 1.7 };

// Above this system font scale, side-by-side layouts stack so the screen never scrolls sideways.
export const stackedFontScale = 1.3;

// The large-text mode grows text only while the system font is below largeTextUpToFontScale: whoever already set a
// large font gets only its stronger contrast, instead of both scales multiplied.
export const largeTextScale = 1.25;
export const largeTextUpToFontScale = 1.3;

// The large-text mode also strengthens contrast: supporting text in ink and stronger borders.
export const contrast = {
  normal: { supportText: colors.graphite, border: colors.divider, borderWidth: 1 },
  strong: { supportText: colors.ink, border: colors.outline, borderWidth: 2 },
};

// Touch targets in dp.
export const touch = { minimum: 56, main: 64, gap: 16 };
