# 集群概览：主题 × 语言走查（2026-11-18）

能力矩阵里「集群概览」一行写着「所有主题/语言未在该批验收」。本轮补上。

## 覆盖

| 语言 | 主题 × 色调 | 状态 | 横向溢出 | 裸标识符 |
| --- | --- | --- | --- | --- |
| zh | violet/dark | ready | 0px | 无 |
| zh | violet/light | ready | 0px | 无 |
| zh | green/dark | ready | 0px | 无 |
| zh | green/light | ready | 0px | 无 |
| en | violet/dark | ready | 0px | 无 |
| en | green/light | ready | 0px | 无 |

截图：`/tmp/overview-<locale>-<accent>-<theme>.png`（1440×900）。

## 目视复核（浅色 + violet）

六张指标卡（GPU 显存 / GPU 卡 / CPU / 内存 / 容器组 / 磁盘）数值完整、单位正确、趋势图正常；
侧栏与页头在浅色下对比度可读，无横向滚动。

## 一处数据语义观察（已复查定性）

「GPU 卡」卡显示：**已使用 0 卡 / 总量 23 卡 / 已分配 34 卡**。已分配大于总量。

复查原始指标（`GET /kapis/monitoring.kubesphere.io/v1alpha3/cluster?metrics_filter=<name># 集群概览：主题 × 语言走查（2026-11-18）

能力矩阵里「集群概览」一行写着「所有主题/语言未在该批验收」。本轮补上。

## 覆盖

| 语言 | 主题 × 色调 | 状态 | 横向溢出 | 裸标识符 |
| --- | --- | --- | --- | --- |
| zh | violet/dark | ready | 0px | 无 |
| zh | violet/light | ready | 0px | 无 |
| zh | green/dark | ready | 0px | 无 |
| zh | green/light | ready | 0px | 无 |
| en | violet/dark | ready | 0px | 无 |
| en | green/light | ready | 0px | 无 |

截图：`/tmp/overview-<locale>-<accent>-<theme>.png`（1440×900）。

## 目视复核（浅色 + violet）

六张指标卡（GPU 显存 / GPU 卡 / CPU / 内存 / 容器组 / 磁盘）数值完整、单位正确、趋势图正常；
侧栏与页头在浅色下对比度可读，无横向滚动。

）：

| 指标 | 值 | 页面对应 |
| --- | --- | --- |
| `cluster_gpu_usage` | **0** | 已使用 0 卡 / 使用率 0% → **真实零，显示正确** |
| `cluster_gpu_total` | **23** | 总量 23 卡 |
| `cluster_gpu_allocated` | **34** | 已分配 34 卡 |

**结论：UI 没有错**——它如实显示服务端给的三个数；「已分配 34 > 总量 23」是**服务端指标口径**的问题
（可能是 vGPU 切分后按份数累计，也可能是聚合错误）。

这属于后端/监控侧的口径问题，不在本次 UI 迁移范围内；已记录现象与证据，供后端侧核对。
**没有为了让数字好看而改动任何一处。**

## 未覆盖

生产前端、真实 member 集群（`xc` 已于 2026-11-18 移除）、全站串行回归。
