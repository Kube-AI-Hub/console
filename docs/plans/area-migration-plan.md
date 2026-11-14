# 新 UI 区域接入方案（kube-frontend / console-next）

> 方法：见 [legacy-ui-migration-guide.md](../legacy-ui-migration-guide.md)。
> 验证基准：**B200**（BFF `127.0.0.1:8092` + 静态站 `127.0.0.1:5178`，集群 `host`）。A100 的旧结论已作废。
> 当前区域接入约定，2026-11-15 整合。本文不再复制页面数量、实时 TODO、逐轮进度或瞬时环境故障。
> 当前能力复核任务见[能力矩阵](capability-matrix.md)，排期见[执行路线](migration-execution-roadmap.md)，
> 每页验收使用[交付模板](page-migration-template.md)。旧正文保留在 git 历史，不能沿用旧章节/行号。

---

## 0. 执行依据

| 问题 | 正文 | 边界 |
| --- | --- | --- |
| 页面入口 | `areas/registry.ts` 与文件路由 | 注册和可达不证明能力完整 |
| 老 URL 段归宿 | `python3 prd/tools/gap_check.py` | 覆盖有限，动态子页与区块字段还须人工清点 |
| 规格追溯 | [SDD](../SDD.md) 与 `check_docs.py --strict` | 只核已登记内容，不发现漏写的旧能力 |
| 逐页 AC 索引 | [生成审计](page-parity-audit.md) | `parity_report.py` 生成，不手改，不是验收报告 |
| 当前待办 | [能力矩阵](capability-matrix.md) | 只更新一处；不复制历史 GAP 数量 |
| 完整交付方法 | [迁移指南](../legacy-ui-migration-guide.md) | 功能/语义/交互/视觉/验证范围同批验收 |

本次文档整合未重验全站；任何测试总数、环境状态和完成比例都须附本次采集证据，不能从旧计划继承。

---

## 1. 结构约定（改不动的部分）

### 1.1 区域注册表是唯一声明处

`apps/console-next/src/areas/registry.ts` 同时驱动侧栏、区域页签、面包屑与路由可达性。
**新增页面必须登记**，否则页面存在但侧栏到不了（已发生过）。

### 1.2 一页三文件

```text
routes/<scope>/<page>/
  route.tsx    # 只渲染 <Outlet/> 的布局路由
  index.tsx    # 列表 / 主页面
  $name.tsx    # 详情（有详情时）
```

文件式路由里 `<page>.tsx` 会成为 `<page>.$name.tsx` 的**父路由**，列表若忘了 `<Outlet/>`，
详情 URL 会渲染成列表（踩过一次）。三件套由 `config/area-contract.test.ts` 守住。

### 1.3 路径保持老 console 形状

加 `/kube-frontend/` 前缀，**不插入区域名**；区域只影响侧栏与页签。

### 1.4 页签切换不产生文档请求

区域内页签是真实 `<a href>`（可中键/⌘ 新开），普通点击走客户端跳转。

---

## 2. 每个功能点的闭环（SDD）

```text
旧原子能力清单 + 数据链路 + 视觉/复用基线
        → tree.py（结构改变时）→ build_prd.py → prd(AC) → design(DEC/不变量/坑) → spec(covers/story)
        → 测试文件（路径镜像 spec）→ generate_case_docs.py
        → check_docs.py --strict + 单测/类型/构建 + 相关串行 E2E + 同次数据/三档视觉复核
```

硬要求：

1. 一 spec 一测试文件，路径镜像 `specs/`；一个文件一个测试函数，docstring 首行是字面 TC ID。
2. AC 只在**功能点文件**里声明一次；L2 索引重复声明会被判编号重复。
3. 「明确不做」必须与实现和批准范围同步；逐页 AC 汇总由 `parity_report.py` 生成，
   旧 `page-parity-report.md` 已退出实时状态维护。不能通过改写“不做”消除待补项。
4. 新增 `DEC` 追加到文件末尾按最大号续编。**引用时必须写完整编号**（`DEC-L3-<模块>-<功能点>-05`），不要写 `DEC-05` 这类短引用：文档门禁的跨文件唯一检查会把短引用当成 ID，与另一个模块的短引用撞号后整棵树变红（2026-11 用户设置组件轮实测，修法是把本模块短引用全部改成完整编号）。

---

## 3. 作用域与接入

以下是接入位置与约定，不是全量页面清单。具体叶子页、详情及条件入口以路由、注册表和单页清单为准；
模块开启后的状态不在这里重复，见能力矩阵。读到旧“模块关闭不做”时必须重新核实实际请求和产品范围。

### 3.0 企业空间级

`/kube-frontend/workspaces/:ws/…`

| 区域 | 页面 |
| --- | --- |
| 企业空间 | overview（基本信息 + 项目/成员计数）、projects（列表 + 链到项目控制台）、members（成员/角色/状态/最近登录）、quota（项目 × 资源配额）、roles（企业空间角色）、user-groups（用户组与成员数） |

企业空间是独立作用域（侧栏、面包屑与项目作用域分开），不能用平台企业空间详情替代其完整任务。

### 3.1 项目级

`/kube-frontend/:ws/clusters/:c/projects/:ns/…`

| 区域 | 页面 |
| --- | --- |
| 项目概览 | overview（配额用量、限额、快捷入口） |
| 配置 | configmaps、secrets、serviceaccounts |
| 应用负载 | deployments、statefulsets、daemonsets、jobs、cronjobs、pods、services、ingresses |
| 存储 | persistentvolumeclaims、volumesnapshots |
| 监控告警 | alerts、alertingrules |
| 项目设置 | baseinfo、roles、members、networkpolicies（含策略详情与 YAML 编辑）、gateways、log-collections |

容器详情、详情页签、定制表单和 YAML 编辑各有独立能力范围，以对应 PRD/design 为准；
有 YAML 编辑不等于已迁定制表单，有详情页面不等于其全部页签完成。

### 3.2 集群级

`/kube-frontend/clusters/:c/…`

| 分组 | 页面 |
| --- | --- |
| 概览 | overview、nodes、node-usage、components |
| 资源 | namespaces、custom-resources |
| 配置 | secrets、configmaps、serviceaccounts（只读、带项目列、跳回项目页） |
| 工作负载 | pods、deployments、statefulsets、daemonsets、jobs、cronjobs、services、ingresses |
| 网络 | ippools、networkpolicies |
| 存储 | storageclasses、persistentvolumes |
| 监控告警 | monitor、custom-monitoring、events、logs、audit-logs |
| 集群设置 | settings、visibility、members、log-collections |

集群列表（`/kube-frontend/clusters`）owns 添加/编辑/移除；切换集群走侧栏顶部的切换器。

### 3.3 平台级

| 区域 | 页面 |
| --- | --- |
| 访问控制 | users、clusterroles、workspaces（+ 用户/企业空间/平台角色详情） |
| 平台设置 | info（含外观色调）、mail、dingtalk、wecom、slack、webhook |
| 应用商店 | store（浏览）、categories、reviews |
| 应用商店管理 | `/kube-frontend/apps-manage`（store/categories/reviews 三页签） |
| 工作台 | `/kube-frontend/`（企业空间 → 项目入口） |

### 3.4 跨作用域与写能力

创建、编辑信息、专用表单、YAML、启停、批量、授权和删除分开验收，记录角色条件和写后回读。
同名对象、项目角色与集群角色、用户 kubeconfig 与成员连接配置不可混用；
请求路径和查询缓存同时包含正确作用域，member 不可静默回退 host。
DevOps、联邦项目和商城的骨架/只读列表只是有限范围，有入口不等于完整区域已迁移。

---

### 3.5 组件开启后的新增范围（2026-11-15）

用户确认「所有组件已开启」后，原先因模块关闭而不迁移的条目进入范围。探测依据：应用商店 30 应用/8 分类、`nginxes` 1 个、`federatednamespaces` 1 个、`servicemesh strategies` 200、边缘节点 `sg`（label `node-role.kubernetes.io/edge`，Ready）。

| 区域 | 新 UI 落点 | 状态 |
| --- | --- | --- |
| DevOps 工程 | 集群区域 `devops`（列表 + 成员/角色/凭证/流水线/CD/代码仓库页签） | 已交付（`0f4612302`、`7a13c0b59`） |
| 联邦项目 | 工作空间区域 `federated-projects`（列表 + 概览/应用负载/配置/存储页签） | 已交付首批（`daf3f6ace`、`b0cb1f36f`） |
| 企业空间应用仓库 | 工作空间区域 `app-repos`（仓库/应用） | 已交付（`751bdb084`） |
| 镜像构建器 | 项目区域 `devops-project`（v1alpha1 s2ibuilders） | 已交付（`89ed2b4cf`） |
| 灰度发布 | app-workloads `grayrelease` 列表 | 已交付（`2fce6985f`） |
| 集群网关详情 | `clusters/$cluster/gateways/$name` | 已交付（`449be408c`） |
| 应用商店应用详情 | `apps/$appId`（版本表 + Readme） | 已交付（`f19dcd169`） |
| 边缘节点 | 集群区域 `edgenodes`（列表复用节点详情） | 已交付（`f002ec7a8`） |

仍登记为缺口：联邦 22 条详情路由的剩余部分、DevOps 流水线详情页；第三方登录（服务端注入，无控制台写路径）与边缘节点接入属明确不做/后续批次。


## 4. 不变量与已知坑

跨页面的结论，改动前先看这一节。**每条都来自一次真实故障。**

### 4.1 读取

1. **按接口契约选择读写路径**：resources 聚合通常只支持 GET，写走原生组；
   企业空间等例外须以实际注册/请求为准，不能把经验当成所有 API 的规则。
2. **`metrics.k8s.io` ≠ KubeSphere 监控**：前者只给当前用量，后者才有总容量/已分配/配额/GPU。
3. **接口形状不统一**：`components` 返回裸数组，其余返回 `{items}`；两种都接受。
4. **指标缺失 ≠ 0**：单字段不返回或空 result 显示 `-`/未上报；请求失败给不可用说明与恢复出口，
   整个面板加载中给骨架；不混为0或空表。
5. **Pod 指标结构与节点不同**：节点 `{metadata, usage}`，Pod `{metadata, containers:[{usage}]}`。

### 4.2 写入

6. **JSON merge patch**：`null` 删除键、键缺失表示不变。清空注解必须显式发 `null`（踩过 3 次）。
7. **PUT 是整对象替换**：只发部分字段会清掉其余字段。
8. **改 IAM 用户角色用 PUT**（PATCH 405）；IAM 对不存在的用户返回 **500**（消息含 not found），需窄条件判定。
9. **企业空间写走 kapis** `/kapis/tenant.kubesphere.io/v1alpha2/workspaces`；`/apis` 是 404，PATCH 500。
10. **平台角色必须写原生 RBAC**：走 IAM 返回 200 但 `rules` 被丢弃；`apiGroups` 留空写成 `[""]`。
11. **告警资源名随版本变**（3.3 `alertingrules` / 3.4 `rulegroups`）：用 API 组的 resources 清单探测，
    不要用版本号猜；读不存在的资源会得到 200 空体。
12. **百分比型指标必须除以总量**：`cluster_cpu_usage` 单位是核、`memory_usage_wo_cache` 是字节。
13. **上游错误正文常是纯文本**（admission webhook）：BFF 只读 JSON `message` 会把它替换成 `Conflict`。

### 4.3 呈现

14. **不显示与事实不符的 0**：未就绪是「未知/计算中」；「0 / 0」读起来像功能坏了。
15. **颜色不是唯一信息通道**：能力徽标只渲染支持项，不给不支持染灰（会被读成"都支持"）。
16. **状态文案收敛**到 `lib/status.ts` 的 `statusLabel`，未知值原样返回。
17. **空值统一 `-`，时间统一 `formatTimestamp`**。
18. **能点就不能无效**：不支持的操作用 `visible` 隐藏，不要点了静默 return。

### 4.4 表单与弹窗

19. **字段键不能带点**：`setByPath` 会把 `requests.cpu` 当嵌套路径，用 `requests_cpu` 再映射。
20. **提交失败必须在对话框内显示**（曾直接 await 导致 unhandled rejection，界面无反应）。
21. **校验失败把焦点移到第一个错误字段**。
22. **先开弹窗再加载数据**，加载中显示 loading。

### 4.5 测试

23. **断言区分完整清单与可扩展 UI**：旧能力/选项/必需字段须精确覆盖；
    可新增的展示列可用子序列，不能靠放宽集合断言隐藏遗漏。
24. **「按钮可用」不算验证功能**：批量删除曾因此长期不可用。
25. **用例必须回读数据**：页面显示成功不等于保存成功。
26. **慢不是跳过或报无数据的理由**：等待有界且可观察，不睡眠循环重试；
    超时/失败/真实空分开，先确认环境与查询范围。
27. **对象名用 uuid**，不要按时间取模（1000 秒循环一次，残留对象后每次都 409）。
28. **不要选别的用例创建的对象**：`tc-e2e-`前缀对象随时被所属用例删除。
29. **表单挂载晚于弹窗**：等字段可见再填。
30. **并发下保留失败再串行复核**：用例不共享可变对象；相关及共享影响回归是本批判据，
    全站串行是发布判据，不因局部通过冒称全站通过。

### 4.6 判定口径

31. **`configz` 是配置事实，不是可用性证明**：历史上 `network=false` 时 IP 池仍可读；
    开关为 true 也要探测接口，组件配置、对象、运行健康和分类入口不能互相替代。
32. **404 按实际服务版本、路径和角色核对**：历史上某组对象仅在 v1alpha2 可读，
    不能由此降级全部监控指标；一次404只证明该请求未成功。
33. **导航不是页面全集**：下钻页、详情页签、模块门控菜单都不在 `config.yaml` 里。

### 4.7 组件复用

34. **结构不手写**：字段用 `FormField`，页签用 `Tabs`，只读行用 `DescriptionItem`，
    强度展示用 `PasswordStrengthMeter`，图标和图表用共享实现。先确认现有 API；
    新增/扩展能力补 Storybook 与既有消费者回归。[用户设置案例](user-settings-component-analysis.md)仅为历史证据，
    其中调用点数量和接口签名不得直接作为当前修改清单。

---

### 4.8 构建与环境证据

35. 改 BFF/代理后重启对应进程，改共享包或静态页面后重新构建；验收记录实际运行版本，
    不能只比 HEAD。固定本批构建，避免并行任务替换 dist 后沿用旧截图结论。
36. 隧道、BFF、静态站端口在听不等于请求可用；登录、短请求和长连接各自确认。
    超时保留证据，按具体进程与端口操作，不误杀并行服务，不以无限重启循环隐藏失败。
37. watch/日志/终端有独立生命周期，切页和关闭需释放；长连接不能占满短请求连接池。
    握手101不代表终端可用，以真实 stdout/PTY/交互和释放连接为判据。
38. 写类失败而读类正常时核对上游 webhook/控制器与实际请求，不仅凭一段错误直接归因。
    环境故障只能阻塞相关验证，不把旧事故的原因当作本次诊断结论。
39. 逐页审计是登记内容的生成索引，不是旧能力全集。以独立能力清单和截图发现漏写项，
    不能让生成器输出决定产品删减。历史故障与数量可从本文 git 历史查阅。

### 4.12 两类「数据看起来对、页面看起来错」的陷阱（2026-11-15 实测）

44. **kapis 的节点集合包含控制台不渲染的节点**：B200 的 kapis nodes 返回 3 个，其中 `sg`（arm64、role=edge）没有出现在节点列表里。用例若取 `items[0]` 再去找行，就会对着一个永远不存在的行断言。正确做法：先取**页面实际渲染的行**（`[data-ai-row]`），再用该名字回读对象。
45. **监控的近窗原始序列可能缺失，只有降采样数据在**：同一 `pod_usage` 查询，1h/6h/24h 窗口返回 0 条，7d 窗口返回 519 条；页面据此显示「无数据」是**正确**的。用例的「监控是否可用」探针必须使用与页面相同的窗口与步长（1h/60s），否则会误判为「有数据」再指责页面空态。

## 5. 验证与门禁

```bash
cd console

# 聚合静态与单测；不包含显式类型/构建/Storybook/视觉验收
python3 prd/tools/verify.py --no-e2e

# 全站快速反馈（4 worker）；用例须隔离可变对象
python3 prd/tools/verify.py

# 全站发布判定；单页交付另跑本批相关及共享影响用例 -n 0
python3 prd/tools/verify.py --serial-e2e
```

`verify.py --no-e2e` 依次跑：文档门禁 → 一致性核对 → **缺口清单** → 架构契约 → 三个包单测。

| 检查 | 回答什么 |
| --- | --- |
| `check_docs.py` | 文档/规格/测试是否自洽 |
| `parity_check.py` | 已登记页面是否都有规格 |
| **`gap_check.py`** | 纳入脚本范围的 URL 段是否有归宿；不覆盖全部动态路由/字段 |
| `consistency-contracts` | 中英文键、`t()` 字面键、barrel 导出、状态文案唯一 |

聚合门禁不能证明旧能力全集，显式类型检查、生产构建、Storybook 和视觉复核按本批范围补跑。
串行验收使用稳定构建和可观察环境，不在测试中途替换 dist/BFF；
基线错误、并发失败、skip 和未执行分别报告，不把失败直接归为环境问题。

---

## 6. 当前待办入口

旧 TODO 混有已完成项目、旧环境阻塞和新增范围，已退出本文的当前状态正文。
有效复核任务整合到[能力矩阵的当前台账](capability-matrix.md#0-当前复核台账)，
对应旧 R 编号和批次证据保留，不能因整合丢掉尚未验收的能力。
选定某页后用[交付模板](page-migration-template.md)建立原子清单；本页完成更新矩阵一行，不回到多个旧计划追加。

概览功能与视觉验收分别见[补齐记录](cluster-overview-completion-20261115.md)和
[布局复盘](cluster-overview-layout-review-20261115.md)，这里只链接，不再复制八项清单或测试总量。
本地通过不代表生产/member/全站通过，历史错误恢复与否须重跑检查后更新对应台账。

---

## 7. 历史漏页经验（不是当前进度）

### 7.1 五条根因

| # | 根因 | 证据 |
| --- | --- | --- |
| R1 | **清单来自导航而非源码**：`config.yaml` 只有菜单，漏下钻页、详情页签、模块门控页 | 迁移指南"以源码为准"只用在实现阶段 |
| R2 | **检查粒度是一级目录**：`Workload/`（8 页）被当结构性目录跳过；`Storage/` 对上一个已迁页即整块算完成 | `parity_check.py` 的 `STRUCTURAL_DIRS` 与 `CLUSTER_PAGES` |
| R3 | **「作用域错误」被当成「不做」**：一条判断覆盖了同批真实存在差异的页面 | 集群级负载有 PROJECT 列与集群角色口径 |
| R4 | **「已迁移」只核页面在不在**，不核能力 | Deployment 是 ✅ 但改不了镜像 |
| R5 | **报告从文档生成**，文档不更新则两头错 | parity 报告由 PRD「明确不做」生成 |

### 7.2 五条防缺规则

1. **路由脚本加人工原子清单**，不从导航或新 PRD 反推旧能力；独立终端与动态子页补充核对。
2. **每个段必须落在四类之一**，各要有证据；未归类 = 门禁失败。
3. **「已迁移」必须同时登记能力覆盖度**，只标 ✅ 不算。
4. **「明确不做」与代码同源**：PRD 更新 → 重生成报告 → diff 里出现增删要人工确认。
5. **每轮先回答范围与未验收项**：路由归宿只作辅助，旧能力、数据、交互、视觉与部署分别结论。

> 2026-11-15：所有组件已开启，原「模块关闭故不迁移」的条目（DevOps / 联邦项目 / 灰度发布 / 应用仓库 / 镜像构建器）已移入 §3.0 的新增范围；仅保留边缘节点（404）与第三方登录（服务端注入）为明确不做。

### 7.3 已推翻的旧结论（保留，避免再犯）

以下只记录历史纠正，不是当前页面清单或模块健康结论。

| 旧结论 | 纠正依据 |
| --- | --- |
| 项目页存在就不需要集群配置入口 | 集群有跨项目定位任务；只读列表、项目列与所属项目下钻有独立价值 |
| 模块开关可决定产品不迁移 | 配置事实不能代替实际 API/角色/版本探测和产品批准 |
| 一个版本404就是整个能力不可用 | 要按实际路径、服务版本和身份区分请求失败与能力缺失 |
| 首页 Top5 可直接被完整节点列表替代 | 默认选项、全局 TopN、标记与下钻是摘要任务，必须证明等价承接 |

### 7.4 已有概览路由仍会漏功能

2026-11-15 的 [概览复盘](./cluster-overview-parity-review-20261115.md) 确认：
ResourcesUsage 同名但漏显存/磁盘，gpu_usage 已请求却丢弃，Kubernetes 四数字中 error 被
unschedulable 替换，组件开关徽标替代了分类入口，Top5 没有等价承接。

**为什么前一轮没发现**：迁移清单停在区块标题；PRD 缩小范围后测试按新 AC 编写；
路由/文档门禁只能证明存在与自洽；新布局截图没有逐项对照旧概览全页。
“避免重复实现”被误用于删除首页摘要，早先“产品没有某模块”的判断没有实际接口证据。

随后[视觉复盘](cluster-overview-layout-review-20261115.md)发现，补功能仍不足以保证区块列顺序、
资源字段对齐及主题边框一致。纠正规则已整合到[指南 §1](../legacy-ui-migration-guide.md#1-一次完整交付的原则)
和[交付模板](page-migration-template.md)，同批定义并验收五项维度，不再追加另一套检查表。

---

## 附录：历史

第 1–120 轮的逐轮叙述已从本文移除（约 2800 行）。需要过程细节时：

```bash
git log --oneline -- docs/plans/area-migration-plan.md   # 每次整理的提交
git show <commit>^:docs/plans/area-migration-plan.md     # 整理前的完整正文
```

当前区域接入注意项见 §4，当前待办唯一入口见 §6，历史经验见 §7。

> 注意：旧分析文档里引用的 `area-migration-plan.md:行号` 与 `§5.x` 已随本次整理失效，
> 引用历史原因请查对应提交，当前状态请查能力矩阵。本次未改脚本，脚本注释中的旧数量/章节不是当前完成证据。
