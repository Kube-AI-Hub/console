export const COMPONENT_GROUPS = [
  { key: 'kubeaihub', namespace: 'kubesphere-system', label: 'Kube AI Hub' },
  { key: 'kubernetes', namespace: 'kube-system', label: 'Kubernetes' },
  { key: 'istio', namespace: 'istio-system', label: 'Istio' },
  { key: 'monitoring', namespace: 'kubesphere-monitoring-system', label: 'cluster.overview.module.monitoring' },
  { key: 'logging', namespace: 'kubesphere-logging-system', label: 'cluster.overview.module.logging' },
  { key: 'devops', namespace: 'kubesphere-devops-system', label: 'DevOps' },
] as const;
