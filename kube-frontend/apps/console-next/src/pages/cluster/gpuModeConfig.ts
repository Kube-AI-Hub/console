import type { NodeSummary } from '@kube-ai-hub/api-client';

export interface GpuModeParameter {
  key: string;
  labelKey: 'node.mode.splitCount' | 'node.mode.memoryScaling' | 'node.mode.coreScaling' | 'node.mode.minUnit' | 'node.mode.virtualCount';
  defaultValue: number;
  integer: boolean;
}
const split: GpuModeParameter = { key: 'devicesplitcount', labelKey: 'node.mode.splitCount', defaultValue: 10, integer: true };
export const GPU_MODES: Record<string, Array<{ value: string; labelKey: 'node.mode.default' | 'node.mode.mig' | 'node.mode.hami' | 'node.mode.dynamic' | 'node.mode.env'; parameters: GpuModeParameter[] }>> = {
  nvidia: [
    { value: 'default', labelKey: 'node.mode.default', parameters: [] },
    { value: 'mig', labelKey: 'node.mode.mig', parameters: [split] },
    { value: 'hami-core', labelKey: 'node.mode.hami', parameters: [
      split, { key: 'devicememoryscaling', labelKey: 'node.mode.memoryScaling', defaultValue: 1, integer: false },
      { key: 'devicecorescaling', labelKey: 'node.mode.coreScaling', defaultValue: 1, integer: false },
    ] },
  ],
  cambricon: [
    { value: 'default', labelKey: 'node.mode.default', parameters: [] },
    { value: 'dynamic-smlu', labelKey: 'node.mode.dynamic', parameters: [{ key: 'min-dsmlu-unit', labelKey: 'node.mode.minUnit', defaultValue: 256, integer: true }] },
    { value: 'env-share', labelKey: 'node.mode.env', parameters: [{ key: 'virtualization-num', labelKey: 'node.mode.virtualCount', defaultValue: 5, integer: true }] },
  ],
};

export function buildModeParams(vendor: string, mode: string, values: Record<string, unknown>): Record<string, string> {
  const definition = GPU_MODES[vendor.toLowerCase()]?.find((entry) => entry.value === mode);
  if (!definition) throw new Error('Unsupported GPU mode');
  return Object.fromEntries(definition.parameters.map((parameter) => {
    const number = Number(values[parameter.key]);
    if (!Number.isFinite(number) || number <= 0 || (parameter.integer && !Number.isInteger(number))) throw new Error('Invalid GPU mode parameter');
    return [parameter.key, String(number)];
  }));
}

export interface ModeRequest {
  mode: string;
  params: Record<string, string>;
  baselineTimestamp: string;
  startedAt: number;
}

export function modeResult(node: NodeSummary | undefined, request: ModeRequest, now = Date.now()): 'waiting' | 'in_progress' | 'completed' | 'failed' | 'external' | 'timeout' {
  const expired = now - request.startedAt >= 300_000;
  const desired = node?.gpuModeDesired;
  if (!desired || desired.timestamp === request.baselineTimestamp || !Number.isFinite(Date.parse(desired.timestamp))) return expired ? 'timeout' : 'waiting';
  if (desired.mode !== request.mode || !sameModeParams(desired.params ?? {}, request.params)) return 'external';
  const status = node?.gpuModeStatus;
  if (!status || Date.parse(status.timestamp) < Date.parse(desired.timestamp) || !Number.isFinite(Date.parse(status.timestamp))) return expired ? 'timeout' : 'waiting';
  if (status.mode !== request.mode) return 'external';
  if (status.status === 'completed' || status.status === 'failed') return status.status;
  if (expired) return 'timeout';
  return status.status === 'in_progress' ? 'in_progress' : 'waiting';
}

export function sameModeParams(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}
