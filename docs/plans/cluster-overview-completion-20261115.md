# 集群概览补齐与逐项验收

> **历史交付证据，非实时状态。** 本文测试结果、当时错误和B200节点数量不代表当前基线；
> 后续布局与关联回归见[视觉复盘](cluster-overview-layout-review-20261115.md)。
> 有效经验已整合至[迁移指南](../legacy-ui-migration-guide.md)，后续验收只更新[能力矩阵](capability-matrix.md)对应项。

## 范围

承接 [源码与截图复盘](./cluster-overview-parity-review-20261115.md)，补齐 OVR-01 至 OVR-08。
验证页面为 `http://localhost:5178/kube-frontend/clusters/host/overview`，经真实 BFF 读取 B200。
代码独立实现，未复制旧 AGPL 组件；未部署生产、未执行 GPU 模式或集群写入，未提交并行工作。

本记录保留前轮功能验收结果；后续布局、统一资源字段及主题边框调整见
[再次视觉复盘](./cluster-overview-layout-review-20261115.md)。用户批准删除 GPU 卡额外利用率文本行，
实际用量、总数、使用/总量比例与分配量仍保留，API 与九维排行能力不变。

## 八项验收

| 缺口 | 已补实现 | 对应验证 |
| --- | --- | --- |
| OVR-01 GPU 显存 | 使用量/总量/比例，bytes 换算 GiB/TiB | OVERVIEW-03 同次采样对账；真实零/缺值单测 |
| OVR-02 磁盘 | 使用量/容量/比例，明确二进制单位 | OVERVIEW-03；原 TB 和现 TiB 的数值变化为单位转换，不是容量改变 |
| OVR-03 GPU 实际用量 | gpuUsed 不再被 mapper 丢弃；实际用量、分配量、总量分别显示，小数保留；后续布局删除额外利用率文本，保留使用/总量比例 | API/面板单测 distinct 1.91 与 6；真实用量对账 |
| OVR-04 调度 error | scheduled/error/unschedulable 三标签独立 | 同次 scheduler 响应对账；1 与 226 不混淆 |
| OVR-05 kubeconfig | 当前用户/集群只读查看、安全提示、下载；主动打开才读，关闭取消并清除缓存 | 真实 GET 与关闭；非敏感模拟文本下载内容/文件名；403 无重试 |
| OVR-06 系统组件 | 六类入口及对象数量；type 下钻、namespace 分类、清除筛选，详情与 Pods 缓存按集群隔离 | OVERVIEW-04、COMPONENTS-01、COMPONENT_DETAIL-01；member 路径单测 |
| OVR-07 Top5 | 九指标、全局服务端排行、IP/控制面/详情链接；完整页保留指标、搜索/分页/刷新/每页档位 | 真实九指标轮换、完整页；模拟12节点取5及10条分页；乱序序列身份单测 |
| OVR-08 可见性 | BasicInfoPanel 显示现有 visibility 字段 | 与当前 Cluster 对象对账 |

使用现有 ai-kit StatisticsGroup/Progress、Table/ResourceList/Pagination、Select、Modal、Textarea，
不新增私有进度条或分页。首页与完整页共用 nodeRankingApi/NodeRankingPanel；
GPU 分配按卡数排序而以分配率展示，load1 不乘100，其余比率乘100，缺失不填零。
GPU/显存在资源区优先展示；新增节点就绪率、原双栏布局和原生 kubectl 保留。

## 验证结果

- 应用类型检查与构建通过。
- 应用全量单测：175 条通过；API 全量单测：290 条通过。
- 新增旧能力清单契约、12 条一致性契约及包边界检查通过；旧资源行引用的指标、九项排行、六类组件有防漏检查。
- 严格 overview/node-usage/components 规格及新增三条镜像用例检查 errors=0、warnings=0。
- 5178 最终串行相关回归：OVERVIEW-01/02/03/04/05、NODE_USAGE-01、COMPONENTS-01、COMPONENT_DETAIL-01，八条通过。
- 三档（1024/1280/1600）检查页面横向溢出为零，表格滚动在内部；全页截图确认六类资源、五个 Kubernetes 字段、Top5、组件及工具均存在。

真实采样与模拟严格区分：B200 当前只有两台节点，“超过5节点的截断/分页”使用12个模拟节点，
不称作真实大型集群验证。真实 kubeconfig 不存入截图、日志或仓库；下载内容与403用非敏感模拟文本验证。

### 尚未通过的全仓项

- API 包全量类型检查仍有两处既有 exactOptionalPropertyTypes 夹具错误：
  `test/network-create.test.ts`、`test/workspace-members.test.ts`。
- 全量 config 契约为1244通过、1失败，失败在未修改的
  `AppStoreAppDetailPage.tsx` 的 AI surface 状态检查，不是概览或排行；未豁免规则或改动并行商店页面。
- 未运行全仓串行 E2E，不将八条相关回归等同全站验证。
- 未部署新版生产前端，因此尚未验证其生产 ingress/TLS；member 组件/配置只有路由隔离单测，无实际成员集群验收。

## 规格与防漏

overview AC-04/05/06 对应新增 YAML/Python OVERVIEW-03/04/05，分别验收指标、工具/组件、排行。
node-usage 与 components 的 PRD/design、既有用例随新能力更新；原“不分类/不做Top5/不下载”
判断保留为被否方案，明确由新决策覆盖，不删除历史理由。

新增 `kube-frontend/config/overview-parity-contract.test.ts` 从旧资源行实际字段引用和排行选项建立独立清单，
不只验证新 PRD 自洽；运行时测试继续核对 mapper、单位、排序和权限，静态清单不能单独代表功能完成。

## 截图

- [1600 全页](./assets/overview-completion-20261115/overview-complete-1600.png)
- [1280 全页](./assets/overview-completion-20261115/overview-complete-1280.png)
- [1024 全页](./assets/overview-completion-20261115/overview-complete-1024.png)
- [完整排行](./assets/overview-completion-20261115/full-node-ranking-real.png)

旧版截图及逐字段差异保留在复盘报告中；本记录只关闭八项本地实现缺口，不覆盖生产部署和成员集群边界。
