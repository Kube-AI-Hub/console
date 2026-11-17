import { createFileRoute } from '@tanstack/react-router';
import { ThirdLoginPage } from '@/pages/platform/ThirdLoginPage';

export const Route = createFileRoute('/kube-frontend/settings/third-login/')({
  component: Page,
});

function Page() {
  return <ThirdLoginPage />;
}
