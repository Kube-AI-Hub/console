/**
 * Every icon available in the sprite.
 *
 * Generated from the migrated kube-design sprite so the type stays in sync:
 * `<Icon name="..." />` only accepts a name that actually exists, which turns a
 * typo into a compile error instead of a blank square in production.
 *
 * De-duplicated on purpose: the upstream sprite defines a few ids twice (for
 * example `event` and `stretch`), and a browser resolves `<use>` to the last
 * one. Listing a name twice would only promise a glyph it cannot show.
 *
 * Regenerate by re-extracting `<symbol id="icon-*">` from `sprite.ts` whenever
 * that file is replaced.
 */
export const ICON_NAMES = [
  'alarm-object', 'android', 'golang', 'gradle', 'java', 'javascript',
  'nodejs', 'php', 'python', 'ascending', 'caret-down', 'caret-left',
  'caret-right', 'caret-up', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up',
  'descending', 'next', 'previous', 'return', 'sort-ascending', 'sort-descending',
  'sorting', 'triangle-down', 'triangle-left', 'triangle-right', 'triangle-up', 'arch-linux',
  'centos', 'coreos', 'debian', 'fedora', 'freebsd', 'ios',
  'linux', 'macos', 'opensuse', 'oracle-linux', 'redhat', 'ubuntu',
  'windows', 'aliyun', 'aws', 'bitbucket', 'ceph', 'etcd',
  'git', 'github', 'gitlab', 'glusterfs', 'google-plus', 'helm',
  'istio', 'jenkins', 'kubernetes', 'kubesphere', 'kubeaihub', 'openpitrix',
  'power', 'qingcloud', 'sonarqube', 'svn', 'vmware', 'add',
  'cardview', 'changing-over', 'check', 'close', 'collapse', 'copy',
  'download', 'drag-handle', 'expand', 'export', 'link', 'listview',
  'logout', 'maximize', 'minimize', 'more', 'pause', 'pull',
  'refresh', 'restart', 'shutdown', 'start', 'stop', 'substract',
  'upload', 'vnc', 'abtest', 'acl', 'admin', 'ai',
  'api', 'appcenter', 'application', 'approve', 'area', 'backup',
  'barchart', 'bell', 'bi', 'bigdata', 'bill', 'binary',
  'bird', 'blockchain', 'blue-green-deployment', 'bm', 'box', 'branch',
  'broom', 'browser', 'calendar', 'camera', 'car', 'cart',
  'catalog', 'cdn', 'certification', 'circle-down', 'circle-up', 'client',
  'clock', 'cloud', 'cluster', 'coding', 'cogwheel', 'column',
  'commit', 'components', 'computing', 'container', 'cookie', 'cpe',
  'cpu', 'creditcard', 'cron-job', 'csv', 'dashboard', 'data',
  'database', 'deal', 'deamon-set', 'debug', 'desktop-group', 'dingtalk',
  'discount', 'display', 'dns', 'docker', 'documentation', 'dot',
  'earth', 'eip-duotone', 'eip-group', 'eip-pool', 'eip', 'email',
  'enterprise', 'error', 'exclamation', 'eye-closed', 'eye', 'file',
  'filter', 'firewall', 'folder', 'fuse', 'gateway-duotone', 'gateway',
  'gpu', 'group', 'hammer', 'home', 'human', 'image',
  'increase', 'information', 'insert-chart', 'ip-port', 'ip', 'ipv6',
  'item', 'jar', 'job', 'key', 'laptop', 'layer',
  'licenses', 'linechart', 'listener', 'loadbalancer', 'lock', 'log',
  'login-accounts', 'login-servers', 'loudspeaker', 'magnifier', 'mail', 'memory',
  'mgmt-node', 'minus-square', 'mirroring', 'mnic', 'monitor', 'nat',
  'network-card', 'network-router', 'network', 'nodes', 'notes', 'os-service',
  'os', 'paper', 'passport', 'pdf', 'pen', 'picture',
  'pie-chart', 'pin', 'plus-square', 'pod', 'port', 'price',
  'project', 'proportion', 'question', 'radio', 'record', 'remark',
  'report', 'resource', 'role', 'router', 'safe-notice', 'scaling',
  'scheduler', 'scissors', 'select', 'shield', 'slack', 'slider',
  'snapshot', 'springcloud', 'springcloudgateway', 'ssd', 'ssh', 'star',
  'starter', 'stateful-set', 'step', 'storage', 'strategy-group', 'stretch',
  'success', 'table-chart', 'tag', 'target', 'templet', 'terminal',
  'text', 'textarea', 'textfield', 'theme', 'thunder', 'ticket',
  'timed-task', 'topology', 'trash', 'update', 'usb-redirection', 'user-overview',
  'user-profile', 'v2v', 'vnas', 'vpn', 'vsan', 'wallet',
  'war', 'webhook', 'wecom', 'wrench', 'xls', 'zone',
  'druration', 'rocket', 'code', 'allowlist', 'apps', 'duotone',
  'conversion-node', 'network-port', 'lab-router', 'feishu', 'loading-duotone', 'logout-right-duotone',
  'tags-duotone', 'chain-off-duotone', 'alarm-lamp', 'layout', 'grid-list', 'observability',
  'grid-row', 'event', 'earth-fill', 'bell-off-duotone', 'volume-off-duotone', 'switch-button-duotone',
  'message-circle-duotone', 'eck', 'edge', 'kafka', 'mongo-db', 'mysql',
  'redis', 'opensearch', 'postgre-sql', 'intranet-routers', 'ip-map', 'meta-data',
  'crane', 'scan-duotone', 'bell-tips-duotone', 'up-circle-duotone', 'apps-duotone', 'clock-duotone',
  'computing-setting', 'cronjob-duotone', 'down-duotone', 'history-duotone', 'map-time', 'network-duotone',
  'prometheus', 'proportion-chart', 'textarea-duotone', 'up-duotone', 'time-backup', 'front-sight',
  'doughnut-chart-duotone', 'intranet-routers-duotone', 'object-storage-duotone', 'edge-cluster-monitoring', 'edge-cluster', 'edge-node',
  'forbid-right-duotone', 'upload-duotone', 'login-left-duotone', 'download-box-2-duotone', 'edge-node-access', 'loading-circle-duotone',
  'iot-duotone', 'glibc', 'mosquitto', 'smart-edge', 'app-4-duotone', 'turn-dot-duotone',
  'turn-dot-delta-duotone', 'node-group', 'note-detail-duotone', 'security-duotone', 'shield-lightning-duotone', 'task-setting',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const ICON_NAME_SET: ReadonlySet<string> = new Set(ICON_NAMES);
