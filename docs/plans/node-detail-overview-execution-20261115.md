# 节点详情与集群概览迁移记录

> **历史批次证据。** 节点验证保留，首版概览的“待补”已由后续[补齐记录](cluster-overview-completion-20261115.md)
> 和[布局复盘](cluster-overview-layout-review-20261115.md)推进；下文旧“八项待补”不是当前 TODO。
> 当前方法见[迁移指南](../legacy-ui-migration-guide.md)，当前复核入口见[能力矩阵](capability-matrix.md)。

> **同日复核补充**：下面记录的是 `38d5eb47d` 当批新增能力与测试，不代表旧概览功能完整。
> 源码和新旧全页截图确认概览仍缺八项能力；具体证据与待补清单见
> [集群概览功能对照与遗漏复盘](./cluster-overview-parity-review-20261115.md)。

## 范围

- 节点详情：`http://localhost:5178/kube-frontend/clusters/host/nodes/gpu02`
- 集群概览：`http://localhost:5178/kube-frontend/clusters/host/overview`
- 参考旧节点详情的信息层次与功能，并独立实现 Apache 2.0 页面，未复制 AGPL 组件。
- 本地构建经 BFF 读取 B200；没有推送、生产前端部署或 GPU 模式切换。

## 交付

节点身份与系统信息放入紧凑侧栏，资源主栏展示六类负载、可切换趋势、健康和容量分配。
新增硬件页，包含物理显卡、RDMA 端口及 GPU/NIC 拓扑；标签与污点独立页签。
终端、调度、YAML、容器组、事件和模式弹窗复用已有实现。

- Requests/Limits 优先上报 map，CPU/内存按对应注解回退；分母为 Allocatable，保留超配。
- Ready True 正常，压力类 False 正常，未知条件不默认为健康。
- NTP 使用集群节点时间中位数，时间缺失明确显示未上报。
- GPU/RDMA 集合返回后再精确校验节点身份，member 未确认的硬件路由拒绝读取。
- RDMA 速率由 bytes/s 转 Gb/s，健康、逻辑状态和资源可用性分开。
- 拓扑按唯一 X 识别行设备，亲和字段独立；未知连接代码保留。

概览采用身份和模块侧栏、资源及控制面主栏；增加协调刷新与节点、显卡、监控、kubectl 快捷入口。
集群指标始终来自 cluster endpoint，不使用 gpu02 数值填充集群总量。
真实零与未返回指标区分；缺值或零分母不绘制 0% 进度条。
节点就绪率采用健康色而不是负载告警色；configz false 文案为未启用，不宣称 API 未安装。
代理未就绪集群继续展示 agent 接入说明。

使用现有 ai-kit StatisticsGroup、Table、TrendChart、Progress、Select、Tabs、Skeleton 与 Modal；
本批仅补 UI barrel 的 Progress 导出，没有重复创建公共展示组件。

## 验证

| 检查 | 结果 |
| --- | --- |
| console-next 类型检查与构建 | 通过 |
| console-next 全量单测，串行判定 | 170 条通过 |
| api-client 全量单测 | 278 条通过 |
| ai-kit 全量单测 | 193 条通过 |
| Storybook 构建 | 通过 |
| config 契约 | 1175 条通过，含 12 条一致性契约 |
| 本批严格 SDD 门禁 | errors=0，warnings=0 |
| `verify.py --no-e2e` | 通过，不代表全量 E2E |
| 5178 串行相关回归 | OVERVIEW-01/02、NODES-03/05/06/11 六条通过 |
| 拓扑亲和和高亮追加断言 | NODES-11 单条复跑通过 |

应用并发单测曾出现列表分页时序失败，串行全量判定全部通过。
API 包全量类型检查仍有既有 `test/network-create.test.ts`、`test/workspace-members.test.ts`
两处 exactOptionalPropertyTypes 夹具错误，本批未放宽检查或改动这些文件。

### 真实 B200 读取与交互

- gpu02 当前返回 7 张显卡、14 个 RDMA 端口；逐列验证序号、型号、设备、端口和链路速率。
  数量是本次读取记录，不硬编码为通用产品默认值。
- 对照上报数据验证 Requests/Limits 分配率、压力条件、拓扑对角项和三列亲和信息。
- 节点终端真实验证目标主机输出、Tab、Esc、1024/1280/1600 PTY 行列与关闭释放连接。
  与前批无输出帧的跳过记录不同，本次为实际通过。
- 元数据回归只增加唯一临时标签，finally 删除；GPU 模式仅打开并关闭，PUT 设拦截保护且没有发起。
- 概览快捷进入 kubectl 只显示准备入口，不自动建立 WebSocket。

### 明确模拟的场景

OVERVIEW-02 拦截集群监控，覆盖真实零、有值但零分母、缺失总量和缺失内存。
面板单测覆盖代理接入说明保留、硬件完整单元格、未知条件、超配及未知拓扑连接。
这些模拟检查不作为 B200 对应异常实际发生的证据。

## 规格与截图

需求与技术方案分别更新 `prd/kube-frontend/cluster-management/{nodes,overview}.md`
及 `design/kube-frontend/cluster-management/{nodes,overview}.md`，同步父级索引。
新增 NODES-11、OVERVIEW-02 YAML 与镜像 Python；03/06 随新表格和元数据页签调整，
保留容量、标签回读、清理和真实趋势采样断言。可读用例和追溯矩阵由生成器更新。

截图位于 `tests/ui/artifacts/` 的对应测试目录，包含：

- `overview-layout-{1024,1280,1600}.png`
- `overview-partial-metrics-simulated.png`
- `node-detail-layout-{1024,1280,1600}.png`
- `node-hardware-{1024,1280,1600}.png`
- NODES-05 的列表/详情终端三档截图

截图检查修复了硬件空单元格、健康文本竖排、速率折行、快捷入口对比和就绪率误标危险色；
横向滚动限制在表格内部。未声称全站自动化对比度审计完成。

## 保留边界

不做节点排空、导入/删除、生产模式切换或未上报设备发现。
member GPU/RDMA 路由和设备拓扑标准化仍需明确后端契约。
本批完成上述两页的范围，不代表所有旧 console 功能已迁移完毕。

## 复核纠正

原先的概览范围把模块配置徽标当作系统组件承接，把节点列表当作首页 Top5 承接，
并省略显存、磁盘、GPU 实际使用量、scheduler error、kubeconfig 和可见性。
这些结论不能由本记录的“六条回归通过”证明：用例仅覆盖当批 AC，未逐项对照旧概览完整能力。
此次复盘没有否定已通过的测试，也没有完成缺口修复；八项均重新登记为待补，
保留双栏布局、共享组件、真实零/未知区分与原生终端的改进。
