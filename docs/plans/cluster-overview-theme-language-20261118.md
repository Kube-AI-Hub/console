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

## 一处数据语义观察（未定性为缺陷）

「GPU 卡」卡显示：**已使用 0 卡 / 总量 23 卡 / 已分配 34 卡**。已分配大于总量。

可能是口径不同（「已分配」统计的是各命名空间的 GPU 申请量，含 vGPU 切分后的份数），也可能是聚合口径错。
**需要对照 ks-apiserver 的原始字段才能定性**，本轮只记录现象，不改数字、不填 0。

## 未覆盖

生产前端、真实 member 集群（`xc` 已于 2026-11-18 移除）、全站串行回归。
