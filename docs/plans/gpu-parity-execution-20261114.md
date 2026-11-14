# 显卡列表与单卡详情迁移记录

> **已交付批次证据，非当前排期。** 下文结果和保留缺口只代表该批；
> 最新需求与契约以 PRD/design 为准，后续核对已整合到[能力矩阵](capability-matrix.md)，不再在本文件追加 TODO。

日期：2026-11-14。方法沿用 [迁移指南](../legacy-ui-migration-guide.md) 与 [SDD](../SDD.md)，不复制旧 AGPL 实现。

## 本批对照

| 能力 | 原新 UI | 本批 |
| --- | --- | --- |
| 显卡筛选 | 全量表，无筛选 | UUID 精确、节点、节点标签、厂商、型号与健康状态组合筛选 |
| 分页与刷新 | limit=-1，一次全量 | 服务端 page/limit，共享 10/20/50/100 档位、刷新与页码 |
| 顶部统计 | 自绘比例条 | ai-kit StatisticsGroup，全局 stats 不随筛选变化 |
| 列与值 | 基础七列、原始厂商 | NUMA、模式、vGPU、核心用量，厂商和模式本地化，列显隐与恢复 |
| 单卡详情 | 两块静态信息 | 概览、容器组、监控、所属节点事件，共享 Tabs |
| 单卡监控 | 无 | 1h/6h/24h，利用率、显存、分配率、功率与温度 |
| 关联容器组 | 无 | 服务端 gpuUuid/nodeName 过滤、搜索与分页 |
| 失败恢复 | 错误替换整页 | 工具栏保留，条件可修正，不显示陈旧数据和分页 |

契约与单位的唯一正文在 [GPU 技术方案](../../design/kube-frontend/cluster-management/gpu.md)。
列表显存来自 MiB，监控显存来自 bytes，分别换算 GiB；零采样与缺失采样不混淆。
空 UUID 不发送，否则后端会精确匹配空字符串而返回空表。

## 公共组件

- 新增 ai-kit TrendChart，包含有限数过滤、真实零值、单点、空态和缺采样断线；GPU 与既有 ClusterMonitorPage 共用。
- ResourceList 增加可选 errorContent，失败时保留筛选和搜索，替换表格与分页；默认调用者行为不变。
- 修正 InputSearch 的内部弹性宽度，防止清除按钮被相邻输入遮挡。
- 复用已交付的 StatisticsGroup、MetricCell、Tabs、ResourceList、Table 与 Pagination。
- Storybook 补趋势图和可恢复筛选错误，不在应用里再造一套列表或图表。

## 验证

- 用户指定 http://localhost:5178 的构建产物连接真实 B200。
- 显卡 GPU-01/02/03 串行 3 条通过；真实筛选、五类指标、关联资源与 1024/1280/1600 截图。
- 125 张卡的多页场景和错误恢复通过浏览器拦截模拟，不创建物理设备或 GPU 任务。
- 集群 MONITOR-01、节点 NODES-08/09 串行 3 条通过，验证公共图表与搜索布局没有回退。
- console-next 全量 163 条、ai-kit 全量 193 条、GPU API 14 条、config 契约 12 条通过；console-next 类型与生产构建、Storybook 和本批严格文档门禁通过。
- `verify.py --no-e2e` 通过；它不等价于全仓库浏览器回归，也不包含 API 包全部测试的 TypeScript 检查。
- API 包全量类型检查仍有 test/network-create.test.ts、test/workspace-members.test.ts 两处既有 exactOptionalPropertyTypes 错误，未降低规则或修改并行范围。
- 本批没有模式 PUT、摘卡、重置、设备插件变更；没有推送远端或部署生产站点。

## 保留缺口

- 单卡 GPU 拓扑、高级图表缩放和多序列交互尚未交付，不以趋势线代替这些能力。
- GPU 读接口只验证 host；member 请求在 API 层拒绝，不偷偷读取 host。
- 所属节点事件不是显卡专属事件，页面已明确说明。
- 存储和成员模块继续由并行方负责，本批不收进其未提交修改。

## 当时后续建议（停止作为排期）

1. 项目级工作负载列表：重新核对状态筛选、分页档位、刷新和失败反馈，保留并行方已交付的列显隐。
2. 工作负载定制编辑：核对资源请求/限额、存储与更新策略，不把 YAML 编辑当作完整表单迁移。
3. GPU/应用资源监控、网关和商城：以真实 API 与控制器能力为准，逐功能点补规格和用例。
4. DevOps 与联邦项目：先做 API discovery 和实际读取，不用菜单开关替代可用性判断。
