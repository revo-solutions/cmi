import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { contrast, largeTextScale, largeTextUpToFontScale, stackedFontScale } from '../theme';
import { getSetting, setSetting } from './db';

const largeTextKey = 'large_text';

type DisplayMode = {
  largeText: boolean;
  setLargeText: (on: boolean) => void;
};

const DisplayModeContext = createContext<DisplayMode>({ largeText: false, setLargeText: () => {} });

// The app's large-text mode: a device setting, not part of the profile (AGENTS.md, "Mobile").
export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [largeText, setLargeTextState] = useState(false);

  useEffect(() => {
    getSetting(largeTextKey)
      .then((value) => setLargeTextState(value === 'true'))
      .catch((error: unknown) => console.warn('Não foi possível ler o modo de letras grandes.', error));
  }, []);

  const value = useMemo<DisplayMode>(() => ({
    largeText,
    setLargeText: (on) => {
      setLargeTextState(on);
      setSetting(largeTextKey, String(on))
        .catch((error: unknown) => console.warn('Não foi possível salvar o modo de letras grandes.', error));
    },
  }), [largeText]);

  return <DisplayModeContext.Provider value={value}>{children}</DisplayModeContext.Provider>;
}

export function useDisplayMode() {
  const { largeText, setLargeText } = useContext(DisplayModeContext);
  const { fontScale } = useWindowDimensions();
  const growsText = fontScale < largeTextUpToFontScale;
  const textScale = largeText && growsText ? largeTextScale : 1;

  return {
    largeText,
    setLargeText,
    // Whether the mode would grow the text on this phone, or only strengthen the contrast.
    growsText,
    textScale,
    contrast: largeText ? contrast.strong : contrast.normal,
    // What sits side by side stacks once the system font and the app's mode together pass the limit.
    stacked: fontScale * textScale > stackedFontScale,
  };
}
