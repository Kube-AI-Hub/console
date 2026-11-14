export const GPU_VENDOR_LABEL_KEYS = {
  CPU: 'node.vendor.cpu',
  nvidia: 'node.vendor.nvidia',
  cambricon: 'node.vendor.cambricon',
  ascend: 'node.vendor.ascend',
  hygon: 'node.vendor.hygon',
  metax: 'node.vendor.metax',
  enflame: 'node.vendor.enflame',
  kunlunxin: 'node.vendor.kunlunxin',
  iluvatar: 'node.vendor.iluvatar',
  alibaba: 'node.vendor.alibaba',
  mthreads: 'node.vendor.mthreads',
} as const;

export function vendorKey(vendor: string): keyof typeof GPU_VENDOR_LABEL_KEYS | undefined {
  const normalized = vendor.toLowerCase() === 'cpu' ? 'CPU' : vendor.toLowerCase() === 'huawei' ? 'ascend' : vendor.toLowerCase();
  return normalized in GPU_VENDOR_LABEL_KEYS ? normalized as keyof typeof GPU_VENDOR_LABEL_KEYS : undefined;
}
