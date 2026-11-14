import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StoreManagePage } from '@/pages/appstore/StoreManagePage';

/** `…/apps-manage/reviews` — 商店审核。 */
export const Route = createFileRoute('/kube-frontend/apps-manage/reviews/')({
  component: reviewsRoute,
});

function reviewsRoute(): React.ReactElement {
  return <StoreManagePage view="reviews" />;
}
