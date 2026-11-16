import * as React from 'react';
import { AiSurface, Button } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { useAuth } from '@/shell/AuthProvider';
import { KubectlConsoleDialog } from '@/components/resource/KubectlConsoleDialog';

export function KubectlPage({ cluster }: { cluster: string }): React.ReactElement {
  const t = useT();
  const { user } = useAuth();
  const [requested, setRequested] = React.useState(false);
  const [phase, setPhase] = React.useState<'loading' | 'ready' | 'error'>('ready');
  React.useEffect(() => { setRequested(false); }, [cluster, user?.name]);
  const state = requested ? phase : 'ready';
  return <AiSurface as="section" aiId="kubectl:surface" state={state} className="flex min-w-0 flex-col gap-4">
    <header>
      <h1 className="text-lg font-semibold text-ai-fg">{t('kubectl.title')}</h1>
      <p className="mt-1 text-sm text-ai-fg-muted">{t('kubectl.description')}</p>
    </header>
    <p className="text-sm text-ai-fg-secondary">{t('kubectl.warning')}</p>
    <Button variant="primary" disabled={!user} {...actionProps('kubectl:prepare')}
      onClick={() => { setPhase('loading'); setRequested(true); }}>{t('kubectl.prepare')}</Button>
    {requested ? <KubectlConsoleDialog cluster={cluster} onStateChange={setPhase} onClose={() => setRequested(false)} /> : null}
  </AiSurface>;
}
