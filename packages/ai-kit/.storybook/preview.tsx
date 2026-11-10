import * as React from 'react';
import type { Preview } from '@storybook/react';
import { DocsContext, DocsContainer as StorybookDocsContainer } from '@storybook/blocks';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { ThemeToggle, AccentToggle } from '../src/theme/ThemeToggle';
import { themes } from '@storybook/theming';
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
      <DocsFrame context={context} theme={theme}>
        {children}
      </DocsFrame>
    </ThemeProvider>
  );
}

/**
 * The docs frame, inside the provider so it can read the current mode.
 *
 * The surrounding chrome (`appBg`, `appContentBg`, borders) is driven by the
 * theme object handed to the docs container, which is why it is resolved from
 * `useTheme` rather than passed through: left at Storybook's default the page
 * went light while its panels stayed dark.
 *
 * The code-block colours are **not** part of this: Storybook 8's theme type has
 * no `codeBg` / token palette (`@storybook/theming` exposes only `fontCode`), and
 * Prism's token colours come from a separate stylesheet that never consults the
 * theme at all. Those are re-pointed at the ai-kit tokens in `storybook.css`.
 */
function DocsFrame({
  context,
  theme,
  children,
}: {
  context: React.ContextType<typeof DocsContext>;
  theme?: Parameters<typeof StorybookDocsContainer>[0]['theme'];
  children?: React.ReactNode;
}): React.ReactElement {
  const { theme: mode } = useTheme();
  /*
   * Only the palettes are overridden, not the whole theme object.
   *
   * Spreading `themes[mode]` over the incoming theme looked tidy but broke the
   * story previews: that object is Storybook's *manager* palette and does not
   * carry everything the docs blocks require, so every `Canvas` rendered its
   * error placeholder while the surrounding prose still painted. Taking the two
   * colour families across keeps the host theme intact.
   */
  const palette = themes[mode];
  const resolved = {
    ...(theme ?? themes.light),
    base: palette.base,
    colorPrimary: palette.colorPrimary,
    colorSecondary: palette.colorSecondary,
    appBg: palette.appBg,
    appContentBg: palette.appContentBg,
    appPreviewBg: palette.appPreviewBg,
    appBorderColor: palette.appBorderColor,
    fontBase: palette.fontBase,
    fontCode: palette.fontCode,
  };

  return (
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
      <StorybookDocsContainer context={context} theme={resolved}>
        {children}
      </StorybookDocsContainer>
    </div>
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
