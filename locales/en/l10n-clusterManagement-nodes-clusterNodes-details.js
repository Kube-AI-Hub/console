/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

module.exports = {
  // Attributes
  ATTRIBUTES: 'Attributes',
  ARCHITECTURE: 'Architecture',
  OS_VERSION: 'OS Version',
  OS_TYPE: 'OS Type',
  LINUX: 'Linux',
  KERNEL_VERSION: 'Kernel Version',
  CONTAINER_RUNTIME: 'Container Runtime',
  KUBELET_VERSION: 'kubelet Version',
  KUBE_PROXY_VERSION: 'kube-proxy Version',
  IP_ADDRESS: 'IP Address',
  SCHEDULABLE: 'Schedulable',
  YES: 'Yes',
  GPU_VIRT_MODE: 'vGPU Mode',
  SET_VGPU_MODE: 'Set vGPU Mode',
  SET: 'Set',
  GPU_MODE: 'GPU Mode',
  SET_VGPU_MODE_DESC: 'Set the node vGPU mode; driver and Device Plugin will be switched to the selected mode.',
  GPU_VIRT_MODE_SWITCHING: 'Switching (target: {mode})',
  GPU_VIRT_MODE_SWITCH_FAILED: 'Switch failed',
  VGPU_MODE_VENDOR_NOT_SUPPORTED: 'The current GPU vendor does not support switching vGPU mode from the console.',
  GPU_MODE_DEFAULT: 'Exclusive',
  GPU_MODE_DEFAULT_DESC: 'Default mode: exclusive device use, no sharing or virtualization.',
  GPU_MODE_DYNAMIC_SMLU: 'dynamic-smlu',
  GPU_MODE_DYNAMIC_SMLU_DESC: 'Dynamic SMLU mode: MLU capacity is allocated in minimum units; supports compute isolation but not multi-card allocation; suitable for multi-task sharing on a single card.',
  GPU_MODE_ENV_SHARE: 'env-share',
  GPU_MODE_ENV_SHARE_DESC: 'Environment variable sharing: a single card is virtualized into multiple devices via env vars for multiple containers; does not support compute isolation.',
  GPU_MODE_MIM: 'mim',
  GPU_MODE_TOPOLOGY_AWARE: 'topology-aware',
  GPU_MODE_MIG: 'MIG',
  GPU_MODE_MIG_DESC: 'NVIDIA MIG (Multi-Instance GPU) mode: a single card is partitioned into isolated instances with balanced isolation and performance.',
  GPU_MODE_HAMI_VGPU: 'hami-vgpu',
  GPU_MODE_HAMI_VGPU_DESC: 'HAMi vGPU virtualization mode: virtual GPU capability is provided by the driver and Device Plugin.',
  GPU_PARAM_MIN_DSMLU_UNIT: 'Min DSMLU unit (min-dsmlu-unit)',
  GPU_PARAM_MIN_DSMLU_UNIT_DESC: 'Minimum allocation unit per MLU in dynamic-smlu mode; default 256.',
  GPU_PARAM_MLULINK_POLICY: 'MLULink policy (mlulink-policy)',
  GPU_PARAM_MLULINK_BEST_EFFORT: 'best-effort',
  GPU_PARAM_MLULINK_RESTRICTED: 'restricted',
  GPU_PARAM_MLULINK_GUARANTEED: 'guaranteed',
  GPU_PARAM_VIRTUALIZATION_NUM: 'Virtualization num (virtualization-num)',
  GPU_PARAM_VIRTUALIZATION_NUM_DESC: 'Number of virtual devices per MLU in env-share mode; default 5.',
  GPU_PARAM_ENABLE_DEVICE_TYPE: 'Enable device type (enable-device-type)',
  GPU_DRIVER_VERSION: 'GPU Driver Version',
  GPU_ENGINE_VERSION: 'GPU Engine Version',
  GPU_DEVICE_SPLIT_COUNT: 'GPU Device Max Share/Split Count',
  // More > Edit Labels
  EDIT_LABELS: 'Edit Labels',
  LABEL_PL: 'Labels',
  // More > Edit Taints
  TAINTS: 'Taints',
  EDIT_TAINTS: 'Edit Taints',
  TAINTS_DESC: 'Add taints to nodes so that pods are not scheduled to the nodes or not scheduled to the nodes if possible. After you add taints to nodes, you can set tolerations on a pod to allow the pod to be scheduled to nodes with certain taints.',
  COMMON_TAINTS: 'Common Taints',
  NOSCHEDULE: 'Prevent scheduling',
  PREFER_NOSCHEDULE: 'Prevent scheduling if possible',
  NOEXECUTE: 'Prevent scheduling and evict existing pods',
  TAINT_SELECT_TIPS: 'Join Common Taints',
  TAINTS_TIPS: '<b>Prevent scheduling</b><br />Prevents all pods from being scheduled to the node.<br /><br /><b>Prevent scheduling if possible</b><br />Prevents all pods from being scheduled to the node if possible.<br /><br /><b>Prevent scheduling and evict existing pods</b><br />Prevents all pods from being scheduled to the node and evict all existing pods on the node.',
  TAINT_DELETE_TIP: 'Delete taint',
  // Running Status > Resource Total
  RESOURCE_TOTAL: 'Resource Total',
  GPU_TOTAL: 'GPU Total',
  GPU_TOTAL_SCAP: 'GPU total',
  VGPU_TOTAL: 'vGPU Total',
  VGPU_TOTAL_SCAP: 'vGPU total',
  GPU_MEMORY_TOTAL: 'GPU Memory Total',
  GPU_MEMORY_TOTAL_SCAP: 'GPU memory total',
  CORE_TOTAL_SCAP: 'Core total',
  CPU_TOTAL_USAGE: 'CPU Total',
  CPU_TOTAL_USAGE_SCAP: 'CPU total',
  MEMORY_TOTAL_USAGE: 'Memory Total',
  MEMORY_TOTAL_USAGE_SCAP: 'memory total',
  POD_TOTAL_USAGE: 'Pod Total',
  POD_TOTAL_USAGE_SCAP: 'pod total',
  DISK_TOTAL_USAGE: 'Disk Total',
  DISK_TOTAL_USAGE_SCAP: 'disk total',
  EPHEMERAL_STORAGE: 'Ephemeral Storage',
  EPHEMERAL_STORAGE_SCAP: 'ephemeral storage',
  // Running Status > Resource Usage
  RESOURCE_USAGE: 'Resource Usage',
  GPU_USAGE_SCAP: 'GPU usage',
  GPU_MEMORY_USAGE: 'GPU Memory Usage',
  GPU_MEMORY_USAGE_SCAP: 'GPU memory usage',
  MAXIMUM_PODS: 'Maximum Pods',
  MAXIMUM_PODS_SCAP: 'Maximum pods',
  DISK_USAGE_SCAP: 'Disk usage',
  // Running Status > Allocated resources
  GPU_REQUEST_SCAP: 'GPU request',
  MEMORY_REQUEST_SCAP: 'Memory request',
  MEMORY_LIMIT_SCAP: 'Memory limit',
  CPU_REQUEST_SCAP: 'CPU request',
  CPU_LIMIT_SCAP: 'CPU limit',
  // Running Status > Allocated Resources
  ALLOCATED_RESOURCES: 'Allocated Resources',
  REQUESTS: 'Lower limit (Requests)',
  LIMITS: 'Limits',
  ALLOCATED_RESOURCES_OVERCOMMIT_TIP: 'Total limits may be over 100 percent, i.e., overcommitted.',
  // Running Status > Health Status
  RUNNING_STATUS: 'Running Status',
  HEALTH_STATUS: 'Health Status',
  NODE_NETWORKUNAVAILABLE: 'Network Availability',
  NODE_NETWORKUNAVAILABLE_DESC: 'Whether the network status of the node is normal.',
  NODE_MEMORYPRESSURE: 'Memory Pressure',
  NODE_MEMORYPRESSURE_DESC: 'Whether the remaining memory of the node is less than the threshold.',
  NODE_DISKPRESSURE: 'Disk Pressure',
  NODE_DISKPRESSURE_DESC: 'Whether the ramaining disk space or inodes of the node is less than the threshold.',
  NODE_PIDPRESSURE: 'PID Pressure',
  NODE_PIDPRESSURE_DESC: 'Whether the number of processes allowed to be created on the node is less the threshold.',
  NODE_READY: 'Readiness',
  NODE_READY_DESC: 'Whether the node is ready to accept pods.',
  LAST_HEARTBEAT_VALUE: 'Last Heartbeat: {value}',
  // Running Status > Taints
  NO_TAINTS_TIPS: 'No taint is found.',
  POLICY: 'Policy',
  // Pods
  READY_VALUE: 'Ready: {readyCount}/{total}',
  STATUS_VALUE: 'Status: {value}',
  // Running Status > GPU Card List
  GPU_CARD_LIST: 'GPU Card List',
  NO_GPU_TIPS: 'No GPU card found on the node.',
  GPU_CARD_INDEX: 'Index',
  GPU_CARD_ID: 'GPU Card ID',
  GPU_CARD_STATUS: 'Status',
  GPU_CARD_MODEL: 'Model',
  GPU_CARD_VGPU: 'vGPU',
  GPU_CARD_COMPUTE: 'Core (Allocated/Total)',
  GPU_CARD_MEMORY: 'Memory (Allocated/Total)',
  GPU_CARD_NUMA: 'NUMA Node',
  GPU_CARD_VENDOR: 'Vendor',
  GPU_CARD_MODE: 'Mode',
  // GPU Detail
  GPU_CARD_SCAP: 'GPU Card',
  GPU_DETAIL_NODE: 'Node',
  GPU_CARD_SUMMARY: 'GPU Summary',
  GPU_ALLOCATION_RATIO: 'GPU Allocation Ratio',
  GPU_ALLOCATION_RATIO_SCAP: 'GPU allocation ratio',
  GPU_POWER: 'GPU Power',
  GPU_POWER_SCAP: 'GPU power',
  GPU_TEMPERATURE: 'GPU Temperature',
  GPU_TEMPERATURE_SCAP: 'GPU temperature',
  GPU_DETAIL_MONITORING_TIPS: 'Power and temperature metrics depend on monitoring collectors. No data is shown when unavailable.',
  GPU_DETAIL_EVENTS_TIPS: 'Compatibility mode: showing events for the parent node. Card-level event filtering requires backend support.',
  GPU_PODS_EMPTY_TIPS: 'No pods found using this GPU card.',
  GPU_TOPOLOGY: 'GPU Connection Topology',
  GPU_TOPOLOGY_SELF: 'Self',
  GPU_TOPOLOGY_LEGEND_TITLE: 'Legend',
  GPU_TOPOLOGY_CONNECTIONS: '{device} Connections',
  // Metadata
  // Monitoring
  USAGE: 'Usage',
  OUT: 'Out',
  IN: 'In',
  // Events
}
