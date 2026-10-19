/*
 * Copyright (C) 2026 Kube AI Hub.
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
  // Navigation pane
  SHARED_STORAGE: '共享存储',
  SHARED_STORAGE_DESC:
    'JuiceFS 共享卷的配额、用量与性能。模型缓存与公共模型库都挂在这里，改配额会同时更新 PV 容量与 JuiceFS 目录配额。',

  // Tabs
  SHARED_STORAGE_OVERVIEW: '概览',
  SHARED_STORAGE_VOLUMES: '卷与配额',
  SHARED_STORAGE_PERFORMANCE: '性能',

  // Overview
  SHARED_STORAGE_VOLUME_COUNT: '共享卷',
  SHARED_STORAGE_TOTAL_CAPACITY: '总配额',
  SHARED_STORAGE_TOTAL_USED: '总已用',
  SHARED_STORAGE_FULLEST_VOLUME: '最高使用率',
  SHARED_STORAGE_USAGE_BY_VOLUME: '各卷使用率',
  SHARED_STORAGE_QUOTA_DRIFT_HINT:
    '卷 {volumes} 的 statfs 容量与 PV 配额暂时不一致：JuiceFS 客户端会缓存目录统计，下一次挂载后会刷新。以配额列为准。',
  SHARED_STORAGE_NESTED_HINT:
    '公共模型库是模型缓存的子目录（model-cache/public），两个目录配额同时生效，实际可用空间取更紧的那个。',
  SHARED_STORAGE_METRICS_OFF_HINT:
    'JuiceFS 客户端指标未开启，性能页没有数据。需要在 juicefs chart 的 driverOptions.metricsAddr 设置 metrics=0.0.0.0:9567 并重建 mount pod。',

  // Volumes
  SHARED_STORAGE_VOLUME: '卷',
  SHARED_STORAGE_DIRECTORY: '目录',
  SHARED_STORAGE_CAPACITY: '配额',
  SHARED_STORAGE_USED: '已用',
  SHARED_STORAGE_USAGE: '使用率',
  SHARED_STORAGE_INODES: 'inodes',
  SHARED_STORAGE_NODES: '挂载节点',
  SHARED_STORAGE_UNKNOWN: '未知',
  SHARED_STORAGE_NOT_MOUNTED: '未挂载',
  SHARED_STORAGE_NESTED_IN: '位于 {parent} 内',
  SHARED_STORAGE_QUOTA_DRIFT: '待刷新',
  SHARED_STORAGE_VOLUMES_HINT:
    '配额即 PV 的 spec.capacity：CSI 驱动每次挂载都会用它覆盖 JuiceFS 目录配额，所以这里改的值会被驱动保持。',
  SHARED_STORAGE_SET_QUOTA: '调整配额',
  SHARED_STORAGE_NEW_CAPACITY: '新配额',
  SHARED_STORAGE_QUOTA_INVALID: '请输入大于 0 的容量，例如 8Ti 或 512Gi。',
  SHARED_STORAGE_QUOTA_BELOW_USAGE: '新配额不能低于当前已用的 {used}。',
  SHARED_STORAGE_QUOTA_HINT:
    '提交后会更新 PV 容量并立即执行 juicefs quota set（目录 {path}）；若执行失败会自动回滚 PV 容量。',

  // Performance
  SHARED_STORAGE_READ_THROUGHPUT: '读吞吐',
  SHARED_STORAGE_WRITE_THROUGHPUT: '写吞吐',
  SHARED_STORAGE_CACHE_HIT_RATIO: '块缓存命中率',
  SHARED_STORAGE_CACHE: '命中率',
  SHARED_STORAGE_CACHE_READ_LATENCY: '缓存读延迟',
  SHARED_STORAGE_FUSE_LATENCY: 'FUSE 操作延迟',
  SHARED_STORAGE_OBJECT_ERRORS: '对象存储错误',
  SHARED_STORAGE_PER_SECOND: '次/秒',

  // On-demand benchmark
  SHARED_STORAGE_BENCH: '主动性能测试',
  SHARED_STORAGE_BENCH_DESC:
    '在选中的卷上写入一个测试文件再读回，测完自动删除。用来区分「存储慢」和「没有流量」。',
  SHARED_STORAGE_BENCH_VOLUME: '卷',
  SHARED_STORAGE_BENCH_FILE_SIZE: '文件大小',
  SHARED_STORAGE_BENCH_THREADS: '线程数',
  SHARED_STORAGE_BENCH_START: '开始测试',
  SHARED_STORAGE_BENCH_RUNNING: '测试中（{seconds}s）',
  SHARED_STORAGE_BENCH_RUNNING_HINT:
    '测试在集群里的一次性 Job 中运行，通常十几秒；可以切走，回来时结果还在。',
  SHARED_STORAGE_BENCH_WRITE: '写吞吐',
  SHARED_STORAGE_BENCH_READ: '读吞吐',
  SHARED_STORAGE_BENCH_FAILED: '性能测试失败',
  SHARED_STORAGE_BENCH_NO_VOLUME: '没有可测试的共享卷',
  SHARED_STORAGE_BENCH_NO_METRICS:
    '测试已经跑完，但曲线仍是 0：写入走的是 CSI 为这个卷单独启动的客户端，而 Prometheus 只抓每节点共享 mount pod 上的 metrics 端点，那个客户端的计数到不了这里。上面的吞吐数字是真实测得的。',

  SHARED_STORAGE_BENCH_WARM_CACHE:
    '每个文件 {size} MiB、{threads} 个线程。读测试用的是本机页缓存（Job 内无法清内核缓存），偏乐观。',

  SHARED_STORAGE_NO_VOLUMES: '没有可管理的共享卷',

  SHARED_STORAGE_NO_TRAFFIC: '该时间范围内无读写',
  SHARED_STORAGE_RANGE_TOTAL: '区间合计',

  // Common
  REFRESH: '刷新',
};
