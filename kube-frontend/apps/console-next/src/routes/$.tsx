import { createFileRoute } from '@tanstack/react-router';
import { NotFoundPage } from '@/components/NotFoundPage';

/** Catch-all: any path the router does not own lands here instead of an empty shell. */
export const Route = createFileRoute('/$')({
  component: NotFoundPage,
});