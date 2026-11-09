import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

/**
 * Router instance.
 *
 * `context` carries the query client so loaders and components can prefetch
 * without importing the app's singleton — which is what makes a test able to
 * mount the router with its own client.
 */
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  /*
   * `scrollRestoration` is on because a resource list longer than the viewport
   * should return to the same row when you come back from a detail page. Without
   * it, every back navigation lands at the top and the user re-scrolls.
   */
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
