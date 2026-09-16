import * as React from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import { ToastProvider } from '../src/components/overlay';
import './storybook.css';

/** Sets `data-theme` on <html> like the Next apps do (tokens.css reads it). */
const withTheme: Decorator = (Story, ctx) => {
  const theme = (ctx.globals.theme as 'light' | 'dark' | undefined) ?? 'light';
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = 'ka';
  }, [theme]);
  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg p-6 font-sans text-body text-text antialiased">
        <Story />
      </div>
    </ToastProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'ფერის თემა',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'fullscreen',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true },
    a11y: {
      // Fail the a11y panel/test-runner on violations, not just warn.
      test: 'error',
      options: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } },
    },
  },
  tags: ['autodocs'],
};
export default preview;
