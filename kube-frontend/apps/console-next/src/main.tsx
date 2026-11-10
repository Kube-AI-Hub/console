import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { ThemeProvider } from '@kube-ai-hub/ui';
import { createQueryClient } from './query';
import { router } from './router';
import { I18nProvider } from './i18n';
import './styles.css';

const queryClient = createQueryClient();
const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

/*
 * `ThemeProvider` sits outside the router so the login page is themed too, and
 * outside `I18nProvider` because the two are independent.
 *
 * The defaults are only the fallback: `index.html` restores a stored preference
 * before first paint, and the provider writes the same choice back on toggle.
 * They match that template — dark with the violet accent — so a reader with no
 * preference never sees a change on hydration.
 */
createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" defaultAccent="violet">
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
