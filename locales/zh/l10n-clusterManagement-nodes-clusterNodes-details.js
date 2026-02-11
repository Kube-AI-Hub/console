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
  ATTRIBUTES: '属性',
  ARCHITECTURE: '系统架构',
  OS_VERSION: '操作系统版本',
  OS_TYPE: '操作系统类型',
  LINUX: 'Linux',
  KERNEL_VERSION: '内核版本',
  CONTAINER_RUNTIME: '容器运行时',
  KUBELET_VERSION: 'kubelet 版本',
  KUBE_PROXY_VERSION: 'kube-proxy 版本',
  IP_ADDRESS: 'IP 地址',
  SCHEDULABLE: '可调度',
  YES: '是',
  GPU_VIRT_MODE: 'vGPU模式',
  SET_VGPU_MODE: '设置vGPU模式',
  SET: '设置',
  GPU_MODE: 'GPU 模式',
  SET_VGPU_MODE_DESC: '设置节点的 vGPU模式，将驱动与 Device Plugin 切换到所选模式。',
  GPU_VIRT_MODE_SWITCHING: '切换中 (目标: {mode})',
  GPU_VIRT_MODE_SWITCH_FAILED: '切换失败',
  VGPU_MODE_VENDOR_NOT_SUPPORTED: '当前 GPU 厂商暂不支持在控制台切换vGPU模式。',
  GPU_MODE_DEFAULT: '独占',
  GPU_MODE_DEFAULT_DESC: '默认模式，设备独占使用，不启用共享或虚拟化。',
  GPU_MODE_DYNAMIC_SMLU: 'dynamic-smlu',
  GPU_MODE_DYNAMIC_SMLU_DESC: '动态 SMLU 模式，支持按最小单元动态分配 MLU 算力，支持算力隔离，但不支持多卡分配；适合多任务共享单卡。',
  GPU_MODE_ENV_SHARE: 'env-share',
  GPU_MODE_ENV_SHARE_DESC: '环境变量共享模式，通过环境变量将单卡虚拟为多份设备，供多个容器共享使用；不支持算力隔离。',
  GPU_MODE_MIM: 'mim',
  GPU_MODE_TOPOLOGY_AWARE: 'topology-aware',
  GPU_MODE_MIG: 'MIG',
  GPU_MODE_MIG_DESC: 'NVIDIA MIG（多实例 GPU）模式，将单卡划分为多个独立实例，隔离性与性能兼顾。',
  GPU_MODE_HAMI_VGPU: 'hami-vgpu',
  GPU_MODE_HAMI_VGPU_DESC: 'HAMi vGPU 虚拟化模式，通过驱动与 Device Plugin 提供虚拟 GPU 能力。',
  GPU_PARAM_MIN_DSMLU_UNIT: '最小 DSMLU 单元 (min-dsmlu-unit)',
  GPU_PARAM_MIN_DSMLU_UNIT_DESC: 'dynamic-smlu 模式下每个 MLU 的最小分配单元，默认 256。',
  GPU_PARAM_MLULINK_POLICY: 'MLULink 策略 (mlulink-policy)',
  GPU_PARAM_MLULINK_BEST_EFFORT: 'best-effort',
  GPU_PARAM_MLULINK_RESTRICTED: 'restricted',
  GPU_PARAM_MLULINK_GUARANTEED: 'guaranteed',
  GPU_PARAM_VIRTUALIZATION_NUM: '虚拟化数量 (virtualization-num)',
  GPU_PARAM_VIRTUALIZATION_NUM_DESC: 'env-share 模式下每个 MLU 的虚拟化数量，默认 5。',
  GPU_PARAM_ENABLE_DEVICE_TYPE: '启用设备类型 (enable-device-type)',
  GPU_DRIVER_VERSION: 'GPU 驱动版本',
  GPU_ENGINE_VERSION: 'GPU 引擎版本',
  GPU_DEVICE_SPLIT_COUNT: 'GPU 设备最大共享/切分数',
  // More > Edit Labels
  EDIT_LABELS: '编辑标签',
  LABEL_PL: '标签',
  // More > Edit Taints
  TAINTS: '污点',
  EDIT_TAINTS: '编辑污点',
  TAINTS_DESC: '为节点添加污点以避免或尽可能避免容器组调度到节点。为节点设置污点后，您可以为容器组设置容忍度以允许容器组调度到有特定污点的节点。',
  COMMON_TAINTS: '公共污点',
  NOSCHEDULE: '阻止调度',
  PREFER_NOSCHEDULE: '尽可能阻止调度',
  NOEXECUTE: '阻止调度并驱逐现有容器组',
  TAINT_SELECT_TIPS: '加入公共污点',
  TAINTS_TIPS: '<b>阻止调度</b><br/>阻止容器组调度到节点。<br/><br/><b>尽可能阻止调度</b>尽可能阻止容器组调度到节点。<br/><br/><b>阻止调度并驱逐现有容器组</b>阻止容器组调度到节点并驱逐节点上现有的容器组。',
  TAINT_DELETE_TIP: '删除污点',
  // Running Status > Resource Total
  RESOURCE_TOTAL: '资源总量',
  GPU_TOTAL: 'GPU 总量',
  GPU_TOTAL_SCAP: 'GPU 总量',
  VGPU_TOTAL: 'vGPU总量',
  VGPU_TOTAL_SCAP: 'vGPU总量',
  GPU_MEMORY_TOTAL: '显存总量',
  GPU_MEMORY_TOTAL_SCAP: '显存总量',
  CORE_TOTAL_SCAP: '核心总量',
  CPU_TOTAL_USAGE: 'CPU 总量',
  CPU_TOTAL_USAGE_SCAP: 'CPU 总量',
  MEMORY_TOTAL_USAGE: '内存总量',
  MEMORY_TOTAL_USAGE_SCAP: '内存总量',
  POD_TOTAL_USAGE: '容器组总量',
  POD_TOTAL_USAGE_SCAP: '容器组总量',
  DISK_TOTAL_USAGE: '磁盘总量',
  DISK_TOTAL_USAGE_SCAP: '磁盘总量',
  EPHEMERAL_STORAGE: '临时存储',
  EPHEMERAL_STORAGE_SCAP: '临时存储',
  // Running Status > Resource Usage
  RESOURCE_USAGE: '资源用量',
  GPU_USAGE_SCAP: 'GPU 用量',
  GPU_MEMORY_USAGE: 'GPU 显存用量',
  GPU_MEMORY_USAGE_SCAP: 'GPU 显存用量',
  MAXIMUM_PODS: '容器组最大数量',
  MAXIMUM_PODS_SCAP: '容器组最大数量',
  DISK_USAGE_SCAP: '磁盘用量',
  // Running Status > Allocated resources
  GPU_REQUEST_SCAP: 'GPU 预留',
  MEMORY_REQUEST_SCAP: '内存预留',
  MEMORY_LIMIT_SCAP: '内存上限',
  CPU_REQUEST_SCAP: 'CPU 预留',
  CPU_LIMIT_SCAP: 'CPU 上限',
  // Running Status > Allocated Resources
  ALLOCATED_RESOURCES: '已分配资源',
  REQUESTS: '下限(预留)',
  LIMITS: '上限',
  ALLOCATED_RESOURCES_OVERCOMMIT_TIP: '总上限可能超过 100%，即存在超卖。',
  // Running Status > Health Status
  RUNNING_STATUS: '运行状态',
  HEALTH_STATUS: '健康状态',
  NODE_NETWORKUNAVAILABLE: '网络可用性',
  NODE_NETWORKUNAVAILABLE_DESC: '节点的网络状态是否正常。',
  NODE_MEMORYPRESSURE: '内存压力',
  NODE_MEMORYPRESSURE_DESC: '节点的剩余内存是否小于阈值。',
  NODE_DISKPRESSURE: '磁盘压力',
  NODE_DISKPRESSURE_DESC: '节点的剩余磁盘空间或 Inode 数量是否小于阈值。',
  NODE_PIDPRESSURE: '进程压力',
  NODE_PIDPRESSURE_DESC: '允许在节点上创建的进程数量是否小于阈值。',
  NODE_READY: '就绪',
  NODE_READY_DESC: '节点是否可以接收容器组。',
  LAST_HEARTBEAT_VALUE: '最后心跳：{value}',
  // Running Status > Taints
  NO_TAINTS_TIPS: '未发现污点。',
  POLICY: '策略',
  // Pods
  READY_VALUE: '就绪：{readyCount}/{total}',
  STATUS_VALUE: '状态：{value}',
  // Running Status > GPU Card List
  GPU_CARD_LIST: '显卡列表',
  NO_GPU_TIPS: '该节点未发现显卡。',
  GPU_CARD_INDEX: '序号',
  GPU_CARD_ID: '显卡 ID',
  GPU_CARD_STATUS: '状态',
  GPU_CARD_MODEL: '型号',
  GPU_CARD_VGPU: 'vGPU',
  GPU_CARD_COMPUTE: '核心(已分配/总量)',
  GPU_CARD_MEMORY: '显存(已分配/总量)',
  GPU_CARD_NUMA: 'NUMA 节点',
  GPU_CARD_VENDOR: '厂商',
  GPU_CARD_MODE: '模式',
  GPU_TOPOLOGY: '显卡连接拓扑图',
  GPU_TOPOLOGY_SELF: '自身',
  GPU_TOPOLOGY_LEGEND_TITLE: '图例',
  // Metadata
  // Monitoring
  USAGE: '用量',
  OUT: '出',
  IN: '入'
};