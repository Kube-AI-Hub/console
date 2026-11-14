import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StoreManagePage } from '@/pages/appstore/StoreManagePage';

/** `…/apps-manage/categories` — 商店分类。 */
export const Route = createFileRoute('/kube-frontend/apps-manage/categories/')({
  component: categoriesRoute,
});

function categoriesRoute(): React.ReactElement {
  return <StoreManagePage view="categories" />;
}
