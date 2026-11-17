import * as React from 'react';
import { Button, Input, Modal } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import type { ComposedAppService } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/**
 * 为自制应用添加一条 Ingress 路由.
 *
 * The old console's "添加路由" step. Host/path are free-form; the backend is chosen from
 * the app's own Services so a route can never point outside the app. [N-01]
 */
export interface ComposedAppRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ComposedAppService[];
  pending?: boolean;
  error?: unknown;
  onSubmit: (input: { host: string; path: string; serviceName: string; servicePort: number }) => void | Promise<void>;
}

export function ComposedAppRouteDialog({ open, onOpenChange, services, pending = false, error, onSubmit }: ComposedAppRouteDialogProps): React.ReactElement {
  const t = useT();
  const [host, setHost] = React.useState('');
  const [path, setPath] = React.useState('/');
  const [serviceName, setServiceName] = React.useState(services[0]?.name ?? '');
  const [servicePort, setServicePort] = React.useState(String(services[0]?.ports[0] ?? 80));
  const [validation, setValidation] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setHost('');
    setPath('/');
    setServiceName(services[0]?.name ?? '');
    setServicePort(String(services[0]?.ports[0] ?? 80));
    setValidation(null);
  }, [open, services]);

  const selected = services.find((service) => service.name === serviceName);
  const portOptions = selected?.ports.length ? selected.ports : [80];

  const submit = (): void => {
    const cleanHost = host.trim();
    const cleanPath = path.trim() || '/';
    if (!cleanHost) return setValidation(t('composedApps.route.error.host'));
    if (!cleanPath.startsWith('/')) return setValidation(t('composedApps.route.error.path'));
    if (!serviceName) return setValidation(t('composedApps.route.error.service'));
    const port = Number(servicePort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return setValidation(t('composedApps.route.error.port'));
    setValidation(null);
    void onSubmit({ host: cleanHost, path: cleanPath, serviceName, servicePort: port });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('composedApps.route.title')}
      description={t('composedApps.route.description')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" loading={pending} {...actionProps('composed-app-route:submit')} onClick={submit}>
            {t('common.create')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="composed-app-route:dialog">
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
          {t('composedApps.route.host')}
          <Input value={host} placeholder="shop.example.test" {...actionProps('composed-app-route:host')} onChange={(event) => setHost(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
          {t('composedApps.route.path')}
          <Input value={path} placeholder="/" {...actionProps('composed-app-route:path')} onChange={(event) => setPath(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
          {t('composedApps.route.service')}
          <select
            className="min-h-9 rounded-ai-md border border-ai-line bg-ai-bg px-2 text-xs text-ai-fg"
            value={serviceName}
            data-ai-id="composed-app-route:service"
            onChange={(event) => {
              const next = event.target.value;
              setServiceName(next);
              const service = services.find((item) => item.name === next);
              if (service?.ports[0] !== undefined) setServicePort(String(service.ports[0]));
            }}
          >
            {services.map((service) => (
              <option key={service.name} value={service.name}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary sm:max-w-40">
          {t('composedApps.route.port')}
          <Input type="number" min={1} max={65535} value={servicePort} {...actionProps('composed-app-route:port')} onChange={(event) => setServicePort(event.target.value)} />
        </label>
        {portOptions.length > 1 ? (
          <p className="text-[11px] text-ai-fg-muted">{t('composedApps.route.portHint')}</p>
        ) : null}
        {validation ? (
          <p className="text-xs text-ai-danger" role="alert" data-ai-id="composed-app-route:error">
            {validation}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-ai-danger" role="alert">
            {String((error as { message?: string }).message ?? error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
