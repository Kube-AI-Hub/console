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
  SHARED_STORAGE: 'Shared Storage',
  SHARED_STORAGE_DESC:
    'Quota, usage and performance of the JuiceFS shared volumes. Both the model cache and the public model store live here; setting a quota updates the PV capacity and the JuiceFS directory quota together.',

  // Tabs
  SHARED_STORAGE_OVERVIEW: 'Overview',
  SHARED_STORAGE_VOLUMES: 'Volumes & Quota',
  SHARED_STORAGE_PERFORMANCE: 'Performance',

  // Overview
  SHARED_STORAGE_VOLUME_COUNT: 'Shared Volumes',
  SHARED_STORAGE_TOTAL_CAPACITY: 'Total Quota',
  SHARED_STORAGE_TOTAL_USED: 'Total Used',
  SHARED_STORAGE_FULLEST_VOLUME: 'Fullest Volume',
  SHARED_STORAGE_USAGE_BY_VOLUME: 'Usage by Volume',
  SHARED_STORAGE_QUOTA_DRIFT_HINT:
    'The statfs capacity of {volumes} does not match its PV quota yet: the JuiceFS client caches directory stats and refreshes them on the next mount. Trust the quota column.',
  SHARED_STORAGE_NESTED_HINT:
    'The public model store is a subdirectory of the model cache (model-cache/public). Both quotas apply, so the effective free space is the smaller of the two.',
  SHARED_STORAGE_METRICS_OFF_HINT:
    'JuiceFS client metrics are off, so the performance tab has no data. Set metrics=0.0.0.0:9567 in the juicefs chart driverOptions.metricsAddr and recreate the mount pods.',

  // Volumes
  SHARED_STORAGE_VOLUME: 'Volume',
  SHARED_STORAGE_DIRECTORY: 'Directory',
  SHARED_STORAGE_CAPACITY: 'Quota',
  SHARED_STORAGE_USED: 'Used',
  SHARED_STORAGE_USAGE: 'Usage',
  SHARED_STORAGE_INODES: 'Inodes',
  SHARED_STORAGE_NODES: 'Mounted Nodes',
  SHARED_STORAGE_UNKNOWN: 'Unknown',
  SHARED_STORAGE_NOT_MOUNTED: 'Not mounted',
  SHARED_STORAGE_NESTED_IN: 'inside {parent}',
  SHARED_STORAGE_QUOTA_DRIFT: 'pending refresh',
  SHARED_STORAGE_VOLUMES_HINT:
    'The quota is the PV spec.capacity: the CSI driver writes it into the JuiceFS directory quota on every mount, so the value set here is the one the driver keeps.',
  SHARED_STORAGE_SET_QUOTA: 'Set Quota',
  SHARED_STORAGE_NEW_CAPACITY: 'New Quota',
  SHARED_STORAGE_QUOTA_INVALID:
    'Enter a capacity greater than 0, for example 8Ti or 512Gi.',
  SHARED_STORAGE_QUOTA_BELOW_USAGE:
    'The new quota cannot be below the {used} already stored.',
  SHARED_STORAGE_QUOTA_HINT:
    'Submitting updates the PV capacity and runs juicefs quota set immediately for {path}; the PV capacity is rolled back if that fails.',

  // Performance
  SHARED_STORAGE_READ_THROUGHPUT: 'Read Throughput',
  SHARED_STORAGE_WRITE_THROUGHPUT: 'Write Throughput',
  SHARED_STORAGE_CACHE_HIT_RATIO: 'Block Cache Hit Ratio',
  SHARED_STORAGE_CACHE: 'Hit ratio',
  SHARED_STORAGE_CACHE_READ_LATENCY: 'Cache Read Latency',
  SHARED_STORAGE_FUSE_LATENCY: 'FUSE Operation Latency',
  SHARED_STORAGE_OBJECT_ERRORS: 'Object Store Errors',
  SHARED_STORAGE_PER_SECOND: 'ops/s',

  // On-demand benchmark
  SHARED_STORAGE_BENCH: 'Throughput Benchmark',
  SHARED_STORAGE_BENCH_DESC:
    'Writes a test file to the selected volume and reads it back, then deletes it. Tells "the storage is slow" apart from "nothing is using it".',
  SHARED_STORAGE_BENCH_VOLUME: 'Volume',
  SHARED_STORAGE_BENCH_FILE_SIZE: 'File size',
  SHARED_STORAGE_BENCH_THREADS: 'Threads',
  SHARED_STORAGE_BENCH_START: 'Run benchmark',
  SHARED_STORAGE_BENCH_RUNNING: 'Running ({seconds}s)',
  SHARED_STORAGE_BENCH_RUNNING_HINT:
    'The run is a one-shot job in the cluster and usually takes seconds. You can leave the page; the result is still here when you come back.',
  SHARED_STORAGE_BENCH_WRITE: 'Write',
  SHARED_STORAGE_BENCH_READ: 'Read',
  SHARED_STORAGE_BENCH_FAILED: 'The benchmark failed',
  SHARED_STORAGE_BENCH_NO_VOLUME: 'No shared volume to test',
  SHARED_STORAGE_BENCH_NO_METRICS:
    'The run finished but the charts are still zero: the writes went through the client the CSI driver starts for this claim, and Prometheus only scrapes the per-node shared mount pod, so those counters never arrive. The throughput numbers above are real.',

  SHARED_STORAGE_BENCH_WARM_CACHE:
    '{size} MiB per file, {threads} thread(s). The read pass is served from the host page cache (a job cannot drop it), so it is optimistic.',

  SHARED_STORAGE_NO_VOLUMES: 'No shared volumes to manage',

  SHARED_STORAGE_NO_TRAFFIC: 'No read or write in this range',
  SHARED_STORAGE_RANGE_TOTAL: 'Range total',

  // Common
  REFRESH: 'Refresh',
};
