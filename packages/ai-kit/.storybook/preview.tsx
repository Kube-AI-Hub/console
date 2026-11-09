import * as React from 'react';
import type { Preview } from '@storybook/react';
import { DocsContext, DocsContainer as StorybookDocsContainer } from '@storybook/blocks';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { ThemeToggle, AccentToggle } from '../src/theme/ThemeToggle';
import '../src/styles/tokens.css';
import '../src/styles/motion.css';
import './storybook.css';

/**
 * Shell around a docs page.
 *
 * Storybook renders the docs frame (`#storybook-docs > .sbdocs-wrapper >
 * .sbdocs-content`) *outside* the story decorator, so those nodes never sat
 * inside `.ai-root`. Their built-in rules (`.sbdocs h1 { color: #2e3438 }`)
 * beat the tokens, which is why the docs page stayed light while the canvas
 * below it was dark.
 *
 * Wrapping the whole frame in `.ai-root` puts the tokens in scope for the title,
 * subtitle and prop table, and gives the page the same background as the canvas.
 * The theme toggles are mounted here because the story decorator skips them in
 * docs mode (once per canvas would repeat them above every example).
 *
 * The remaining props must reach the wrapper's children: the default container
 * passes `context` to the blocks below it, and dropping it made `Stories` and
 * `Controls` throw while resolving their story.
 */
function DocsContainer({
  context,
  theme,
  children,
}: {
  /** Storybook's docs context; the blocks below read it from `DocsContext`. */
  context: React.ContextType<typeof DocsContext>;
  /** Storybook's own theme vars, consumed by the blocks (fonts, colours). */
  theme?: Parameters<typeof StorybookDocsContainer>[0]['theme'];
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <ThemeProvider defaultTheme="dark" defaultAccent="violet">
      <div className="ai-root ai-ambient min-h-screen bg-ai-bg text-ai-fg">
        {/* Same column and inset as the docs content, so the toggles line up
            with the title below instead of sitting on their own grid. */}
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-2 px-5 pt-6 sm:px-2">
          <AccentToggle />
          <ThemeToggle />
        </div>
        {/*
         * Delegate to Storybook's own container instead of re-implementing it.
         * The blocks depend on more than `DocsContext` — they read typography and
         * colours from `theme` — and a hand-rolled provider failed one requirement
         * at a time. This one supplies everything; the wrapper above only adds
         * the ai-kit tokens.
         */}
        <StorybookDocsContainer context={context} theme={theme}>
          {children}
        </StorybookDocsContainer>
      </div>
    </ThemeProvider>
  );
}

/**
 * Every story renders inside the theme provider so the mode and accent toggles
 * actually drive the components. Without this the tokens would fall back to the
 * `:root` defaults and the light theme would never be exercised.
 *
 * The provider owns the page shell (background, padding, toggles) so individual
 * stories only describe their own content. Stories must not add another
 * `ai-root` wrapper — that produced a duplicated header before.
 */
const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    backgrounds: { disable: true },
    layout: 'fullscreen',
    docs: {
      /**
       * Take over the docs frame so it inherits the theme. Without this the
       * title and prop table render with Storybook's fixed light palette.
       */
      container: DocsContainer,
    },
    options: {
      /**
       * Sort entries by name, and pin the category bundles to the end.
       *
       * Storybook's default is alphabetical on the raw title, which put the
       * leftover bundles (`Components/Capabilities`, `Components/Forms`) among
       * the real components. Listing the component names explicitly keeps the
       * sidebar in a fixed, predictable order; anything not listed follows in
       * alphabetical order.
       */
      storySort: {
        order: [
          'Foundation',
          'Components',
          [
            'Alert',
            'AutoComplete',
            'Badge',
            'Breadcrumb',
            'Button',
            'Card',
            'Checkbox',
            'Collapse',
            'DatePicker',
            'Drawer',
            'Dropdown',
            'Form',
            'Input',
            'Loading',
            'Menu',
            'Modal',
            'Notify',
            'Pagination',
            'Popover',
            'Progress',
            'Radio',
            'Select',
            'Slider',
            'Table',
            'Tabs',
            'Tag',
            'TextArea',
            'Toggle',
            'Tooltip',
            'Tree',
            '*',
          ],
          'Schema',
        ],
        method: 'alphabetical',
      },
    },
  },
  decorators: [
    (Story, context) => (
      /*
       * Docs mode: the container already provides the theme and the `.ai-root`
       * scope, so this only has to lay out the example canvas. Creating a second
       * `ThemeProvider` here gave the canvas its own state — toggling the theme
       * at the top of the page left the stories below it unchanged.
       */
      context.viewMode === 'docs' ? (
        <div className="ai-docs-story bg-ai-bg p-8">
          <Story />
        </div>
      ) : (
        <ThemeProvider defaultTheme="dark" defaultAccent="violet">
          <div className="ai-root ai-ambient min-h-screen bg-ai-bg p-8">
            <div className="mb-6 flex justify-end gap-2">
              <AccentToggle />
              <ThemeToggle />
            </div>
            <Story />
          </div>
        </ThemeProvider>
      )
    ),
  ],
};

export default preview;
