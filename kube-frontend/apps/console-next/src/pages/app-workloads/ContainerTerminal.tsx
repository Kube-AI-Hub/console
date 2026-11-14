import * as React from 'react';
import { Button } from '@kube-ai-hub/ui';
import { ExecConsoleDialog } from '@/components/resource/ExecConsoleDialog';
import { useT } from '@/i18n';
import { actionProps } from '@kube-ai-hub/ai-surface';

export interface ContainerTerminalProps {
  cluster: string; namespace: string; pod: string; container: string;
}

/** Keep the container detail contract while sharing connection and output handling. */
export function ContainerTerminal(props: ContainerTerminalProps): React.ReactElement {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  return <section data-ai-id="container-detail:terminal-section">
    <Button variant="secondary" {...actionProps('container-detail:terminal-open')} onClick={() => setOpen(true)}>
      {t('container.terminal.open')}
    </Button>
    {open ? <ExecConsoleDialog target={props} title={t('container.terminal.title')}
      aiPrefix="container-detail" onClose={() => setOpen(false)} /> : null}
  </section>;
}
