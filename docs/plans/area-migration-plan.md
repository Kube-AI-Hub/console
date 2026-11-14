# 老 console 全量迁移方案（kube-frontend / console-next）

> 方法：见 [legacy-ui-migration-guide.md](../legacy-ui-migration-guide.md)。
> 验证基准：**B200**（BFF `127.0.0.1:8092` + 静态站 `127.0.0.1:5178`，集群 `host`）。A100 的旧结论已作废。
> 本文是**执行用**文档：现状、约定、不变量、TODO。逐轮叙述已移除，需要考古时看 `git log -- docs/plans/area-migration-plan.md`。

---

## 0. 现状速览

| 项 | 值 | 怎么核对 |
| --- | --- | --- |
| 已注册页面 | **61**（项目 22 / 集群 27 / 平台 12） | `areas/registry.ts` |
| 老 URL 段归宿 | 已迁移 **59** / 明确不做 **8** / 别处承接 **5** / 已登记缺口 **15** / **未归类 0** | `python3 prd/tools/gap_check.py` |
| 规格 ↔ 测试 | 一一对应，无孤儿 | `python3 prd/tools/parity_check.py` |
| 文档门禁 | errors=0 warnings=0 | `python3 prd/tools/check_docs.py --strict` |
| 逐页能力对照 | 见 [page-parity-report.md](./page-parity-report.md) | — |
| 仍缺什么 | 见 §6 TODO | — |

一条命令全过：`python3 prd/tools/verify.py --no-e2e`（约 80 秒）。

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
tree.py → build_prd.py → prd(AC) → design(DEC/不变量/坑) → spec(covers/story)
        → 测试文件（路径镜像 spec）→ generate_case_docs.py
        → check_docs.py --strict → parity_check.py → gap_check.py
```

硬要求：

1. 一 spec 一测试文件，路径镜像 `specs/`；一个文件一个测试函数，docstring 首行是字面 TC ID。
2. AC 只在**功能点文件**里声明一次；L2 索引重复声明会被判编号重复。
3. 「明确不做」必须与实现同步——`page-parity-report.md` 由 PRD 生成，PRD 不更新报告就两头错。
4. 新增 `DEC` 追加到文件末尾按最大号续编。**引用时必须写完整编号**（`DEC-L3-<模块>-<功能点>-05`），不要写 `DEC-05` 这类短引用：文档门禁的跨文件唯一检查会把短引用当成 ID，与另一个模块的短引用撞号后整棵树变红（2026-11 用户设置组件轮实测，修法是把本模块短引用全部改成完整编号）。

---

## 3. 页面清单

### 3.0 企业空间级（6）

`/kube-frontend/workspaces/:ws/…`

| 区域 | 页面 |
| --- | --- |
| 企业空间 | overview（基本信息 + 项目/成员计数）、projects（列表 + 链到项目控制台）、members（成员/角色/状态/最近登录）、quota（项目 × 资源配额）、roles（企业空间角色）、user-groups（用户组与成员数） |

企业空间是独立作用域（侧栏、面包屑与项目作用域分开）。邀请成员、配额、部门、用户组尚未迁：
分别缺企业空间角色列表与配额/组织模型，见 §6.1。

### 3.1 项目级（22）

`/kube-frontend/:ws/clusters/:c/projects/:ns/…`

| 区域 | 页面 |
| --- | --- |
| 项目概览 | overview（配额用量、限额、快捷入口） |
| 配置 | configmaps、secrets、serviceaccounts |
| 应用负载 | deployments、statefulsets、daemonsets、jobs、cronjobs、pods、services、ingresses |
| 存储 | persistentvolumeclaims、volumesnapshots |
| 监控告警 | alerts、alertingrules |
| 项目设置 | baseinfo、roles、members、networkpolicies（含策略详情与 YAML 编辑）、gateways、log-collections |

> **容器详情**（`pods/$name/containers/$container`）已迁：ES 日志检索、实时日志 tail、容器终端（BFF WebSocket upgrade）。**详情页签体系**已迁（Deployment 5 页签 / Pod 4 页签，见 `app-workloads/detail-tabs.md`）。**定制编辑**见 `app-workloads/edit-form.md`；Node/PV/StorageClass/NetworkPolicy 的 YAML 编辑见 `cluster-management/yaml-edit.md`。

### 3.2 集群级（30）

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

### 3.3 平台级（12）

| 区域 | 页面 |
| --- | --- |
| 访问控制 | users、clusterroles、workspaces（+ 用户/企业空间/平台角色详情） |
| 平台设置 | info（含外观色调）、mail、dingtalk、wecom、slack、webhook |
| 应用商店 | store（浏览）、categories、reviews |
| 应用商店管理 | `/kube-frontend/apps-manage`（store/categories/reviews 三页签） |
| 工作台 | `/kube-frontend/`（企业空间 → 项目入口） |

### 3.4 写能力

编辑信息、编辑 YAML、扩缩容、重新部署、停止/启动、批量停止、批量删除、服务端口、路由规则、
存储扩容、项目配额、创建用户、用户改角色/删除、启停、编辑邮箱描述、平台角色规则与创建、
企业空间增改删、项目角色规则与创建（模板复制）、网络策略创建/删除、网关创建/删除、集群描述编辑、
通知渠道配置（5 种）、文件编辑。

---

## 4. 不变量与已知坑

跨页面的结论，改动前先看这一节。**每条都来自一次真实故障。**

### 4.1 读取

1. **写走原生组、读走 kapis**：kapis 的 `resources` 端点只注册 GET，写返回 405；个别对象写会 400
   `wrong resource GroupVersionKind`。
2. **`metrics.k8s.io` ≠ KubeSphere 监控**：前者只给当前用量，后者才有总容量/已分配/配额/GPU。
3. **接口形状不统一**：`components` 返回裸数组，其余返回 `{items}`；两种都接受。
4. **指标缺失 ≠ 0**：不返回与空 result 都渲染成「不可用」，不显示 0。
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

23. **断言不要写死实现细节**：精确集合断言被新增列打破过 4 次，改子序列。
24. **「按钮可用」不算验证功能**：批量删除曾因此长期不可用。
25. **用例必须回读数据**：页面显示成功不等于保存成功。
26. **慢不是跳过的理由**：慢查询在用例里重试，不报「无数据」。
27. **对象名用 uuid**，不要按时间取模（1000 秒循环一次，残留对象后每次都 409）。
28. **不要选别的用例创建的对象**：`tc-e2e-`前缀对象随时被所属用例删除。
29. **表单挂载晚于弹窗**：等字段可见再填。
30. **并发下先复跑再判定**：串行全绿才是提交依据；并发红了先单独复跑。

### 4.6 判定口径

31. **`configz` 的模块开关是菜单开关，不是接口开关**：`network=false` 时 IP 池照常可读；
    `openpitrix=true` 说明商店可用。判页面能不能做，**探测接口**。
32. **404 要按同组其它版本再探一次**：`monitoring…/v1alpha3` 全 404，对象在 **v1alpha2**。
    只试一个版本得到的 404 证明的是"那个版本没有"。
33. **导航不是页面全集**：下钻页、详情页签、模块门控菜单都不在 `config.yaml` 里。

### 4.7 组件复用

34. **结构不手写**：字段的 label/hint/error 用 `FormField`，页签用 `Tabs`，只读信息行用 `DescriptionItem`，密码强度面板用 `PasswordStrengthMeter`。页内复刻一份，下一个页面就会以另一种方式复刻（实测：字段包装已有 17 个文件各写一遍、只读信息行 24 处依赖应用内私有组件）。用户设置页是第一处被上收的页面，分析与组件清单见 `./user-settings-component-analysis.md`。

---

### 4.8 环境陈旧会让「代码已修好」看起来像坏的（2026-11-14 实测）

35. **改完 BFF 必须重启它，再跑 UI 用例**。节点终端（NODES_05）连续两轮全量验证失败，页面报「节点终端连接失败」。诊断结论：8092 上跑的是 11:34 启动的旧进程，而 `isExecUpgradePath` 的节点终端分支是 15:25 才加的代码——BFF 用 raw HTTP upgrade，路径白名单是**进程内代码**，热更新不会生效。重启后同一用例 11.6s 通过。
36. **推论**：碰到「某功能在浏览器里稳定失败、接口探测 404」时，先比对**进程启动时间与代码修改时间**，再怀疑实现。同类问题还包括 dist 未重建（静态服务器读 `apps/console-next/dist`）。

### 4.9 逐页对照审计是生成物

37. **「逐页对比」不靠人写**：`python3 prd/tools/parity_report.py` 从 catalog 与各 PRD 生成 `docs/plans/page-parity-audit.md`——129 个页面、261 个 AC、194 条用例，每页一行列出「验收场景 / 用例 / 明确不做」。手写的对照表会在下一个页面落地时立刻过期（本轮实测：旧表缺了 12 个新页面）。

### 4.10 长跑验证需要「自愈」的隧道与 BFF

38. **隧道与 BFF 都要按自愈方式跑**。本轮三次全量验证挂起：一次 BFF 端口在听但进程已死（升级测试把它打崩），一次 ssh 隧道 socket 在、转发已断（HTTP 请求永远等到超时），一次被杀进程误杀了 5178。现象都一样——**pytest 以 0% CPU 挂着**，因为用例在等一个永远不来的响应。
39. **落地做法**：`while true; do ssh -N ... ; sleep 3; done` 管隧道；BFF 用同样循环包一层并 append 日志；杀进程时按 **端口** 精确杀（`lsof -i :8092`），不要按 `ps | grep` 批量杀——静态服务器与 BFF 之间有连接，会被一起带走。

## 5. 验证与门禁

```bash
cd console

# 静态与单测（约 80 秒）：改完任何代码先跑这个
python3 prd/tools/verify.py --no-e2e

# 快速 E2E（约 4 分钟，4 worker）：一轮迁移收尾
python3 prd/tools/verify.py

# 权威判定（串行 E2E，约 15 分钟）：提交前
python3 prd/tools/verify.py --serial-e2e
```

`verify.py --no-e2e` 依次跑：文档门禁 → 一致性核对 → **缺口清单** → 架构契约 → 三个包单测。

| 检查 | 回答什么 |
| --- | --- |
| `check_docs.py` | 文档/规格/测试是否自洽 |
| `parity_check.py` | 已登记页面是否都有规格 |
| **`gap_check.py`** | **老 console 每个 URL 段是否有归宿**（唯一能发现"整页没做"的检查） |
| `consistency-contracts` | 中英文键、`t()` 字面键、barrel 导出、状态文案唯一 |

**串行跑必须独占机器**：并发跑构建/单测会造出假失败（实测 2 次，单独复跑均通过）。

---

## 6. TODO

### 6.1 页面级缺口（15 项，`gap_check.py` 的输出即清单）

| 缺口 | 做法 | 备注 |
| --- | --- | --- |
| ~~企业空间控制台~~ | 已按段对齐：概览（含 base-info 重定向）/ 项目 / 成员（含角色授权）/ 配额 / 角色 / 用户组；devops、federatedprojects、apps、repos 因模块关闭明确不做 | gap_check 已把 workspaces 作用域按段枚举，10 段中 6 迁 4 不做 |
| ~~集群级全命名空间 PVC~~ | 已迁：`clusters/<c>/persistentvolumeclaims`（复用 storageApi + 项目索引，行键 ns/name） | 页面本体可复用这点被验证：约 100 行 |
| ~~卷快照 / 快照类型~~（2）/ 快照内容、`snapshots` 别名（2） | 已迁集群级卷快照与快照类型；CRD 存在但 0 对象，空态与「未安装」两条分支都有 | 快照内容与别名路由仍待做 |
| ~~JuiceFS 共享存储~~ | 已迁：`/juicefs-storage` 三页签（卷/用量/性能），聚合 kapis 组 + PV join | 3 卷、11.2TB，性能走监控区间 |
| ~~GPU 卡列表~~ / GPU 资源监控（1） | 已迁显卡列表 + 单卡详情（`/kapis/gpu.kubesphere.io/v1alpha1/gpus`，健康比例走 `/gpus/stats`） | 监控页签未做（需要 Prometheus gpu 指标） |
| ~~应用资源监控~~ | 已迁：`/monitor-resource` 两页签（按工作负载 / 按容器组），Pod 指标聚合 + ReplicaSet 归属 | 无集群级 workloads 集合，工作负载由 Pod 指标聚合得出 |
| ~~集群级告警消息 / 告警策略（2）~~ | 已迁：消息合并 clusteralerts+globalalerts（来源列）；策略两页签「自定义/内置」 | 剩余：集群自定义策略写、内置启停、消息下钻 |
| 集群网关 | 只读展示 | 控制器缺 chart，状态到不了就绪 |
| ~~飞书通知渠道~~ | 已迁：`/settings/feishu`，三种接入方式（用户 ID / 部门 ID / 群机器人），写 v2beta2 | 平台通知 webhook 当前 400，所有渠道写入用例 skip |
| ~~项目级自定义监控~~ | 已迁：`/projects/<ns>/custom-monitoring`（`/apis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>/dashboards`） | 本部署 19 个命名空间均无仪表板 → 页面为空态 |
| 项目级自制应用 | 待核实 `application.kubesphere.io` 是否提供 `applications` 资源 | 该组当前只服务 `helm*` |

### 6.2 能力级缺口（页面在、功能不全）

| 能力 | 现状 | 影响 |
| --- | --- | --- |
| **容器日志 tail** | 已迁：`client.stream()` + `pods/log?follow=true`（HTTP chunked，无需 WebSocket），容器详情页「实时」开关 | 排障第一条通道打通；顺手修了 BFF 泄漏上游流与 dev 静态服务器缓冲两个真问题 |
| **容器终端** | 已迁：BFF `upgrade` 透传 + 原生 WebSocket + `v5.channel.k8s.io` 帧协议，容器详情页可开终端 | 流式通道第一条完整闭环；无 `/bin/sh` 的容器显示错误原因 |
| **kubectl 代理 / 节点 shell** | 容器终端已通；kubectl 与节点 shell 需要独立的会话与权限设计 | 并行线在试探 kubectl 页面 |
| 详情页签体系 | 已迁：概览/监控/关联容器组/修订版本/事件/元数据（Pod 为 概览/监控/容器/事件/元数据）；监控页签只在有工作负载级指标的类型上出现 | Job/CronJob 无工作负载级指标，不给空页签 |
| 编辑 YAML 覆盖 | 21 类 → 17 类（本轮补 Node/PV/StorageClass/NetworkPolicy） | 仍缺集群/平台级若干资源 |
| 定制编辑表单 | 21 种 → 13 种（本轮补 Deployment/StatefulSet/DaemonSet/CronJob 的镜像、环境变量、拉取策略、副本数） | 仍缺多数资源的专属表单 |
| 列表通用能力 | 固定 10 条、无刷新/实时/列显隐、空态无出口 | 缺口分析 F-41~F-46 |
| 帮助/关于、24 项配置入口 | 无 | 体验项 |

### 6.3 流程与环境

- [ ] 补齐能力矩阵：每个页面的「列表/写/详情/通用」四列结论（迁移指南 §3.3 的「能力维度」要求）
- [ ] 商城写操作：建分类、审核通过/驳回（当前商店为空，无法验证）
- [ ] 应用详情与安装：`/apps/:id`、`/apps/:id/deploy`（同上）
- [ ] 面板编辑器与图表渲染（自定义监控，Grafana 风格组件套件）
- [ ] 字段包装收敛：仍有 16 个文件手写 `label + 输入 + 说明/错误`，逐页改用 `FormField`（用户设置页已改；清单见 `./user-settings-component-analysis.md` §7）
- [ ] 工作负载详情页的手写页签改用 `Tabs`（第二个 hand-rolled `role="tablist"`；等该文件当前并行改动稳定后接）
- [x] 4 个整块作用域评估：企业空间**已迁完**（概览/base-info/项目/成员/配额/角色/用户组 + 角色详情；devops、federatedprojects、apps、repos 因模块关闭明确不做）；DevOps / 联邦项目 / 应用商店模板登记为明确不做

---

## 7. 复盘：为什么漏过 115 个页面，以及如何避免

### 7.1 五条根因

| # | 根因 | 证据 |
| --- | --- | --- |
| R1 | **清单来自导航而非源码**：`config.yaml` 只有菜单，漏下钻页、详情页签、模块门控页 | 迁移指南"以源码为准"只用在实现阶段 |
| R2 | **检查粒度是一级目录**：`Workload/`（8 页）被当结构性目录跳过；`Storage/` 对上一个已迁页即整块算完成 | `parity_check.py` 的 `STRUCTURAL_DIRS` 与 `CLUSTER_PAGES` |
| R3 | **「作用域错误」被当成「不做」**：一条判断覆盖了同批真实存在差异的页面 | 集群级负载有 PROJECT 列与集群角色口径 |
| R4 | **「已迁移」只核页面在不在**，不核能力 | Deployment 是 ✅ 但改不了镜像 |
| R5 | **报告从文档生成**，文档不更新则两头错 | parity 报告由 PRD「明确不做」生成 |

### 7.2 五条防缺规则

1. **清单只由脚本从源码枚举**（`gap_check.py`），不来自导航。
2. **每个段必须落在四类之一**，各要有证据；未归类 = 门禁失败。
3. **「已迁移」必须同时登记能力覆盖度**，只标 ✅ 不算。
4. **「明确不做」与代码同源**：PRD 更新 → 重生成报告 → diff 里出现增删要人工确认。
5. **每轮先回答"这一轮没做什么"**：贴 `gap_check.py` 的汇总行，数字比上轮大就当场解释。

### 7.3 已推翻的旧结论（保留，避免再犯）

| 旧结论 | 实际 |
| --- | --- |
| 集群级配置字典/保密字典/服务账户是待迁页面 | 作用域错误：项目资源，集群页已移除 |
| 集群角色需要单独集群页 | 与平台角色统一维护 |
| 企业空间成员不可用 | 可用：`/kapis/iam…/workspaces/<ws>/workspacemembers` |
| 集群日志收集需要日志组件配置 | 可用：`/apis/logging.kubesphere.io/v1alpha2/*` |
| 应用商店 openpitrix 模块关闭 | `configz.openpitrix=true`，接口全 200，**已迁** |
| 集群网络 network 模块未开启 | 只关菜单；`ippools`/`networkpolicies` 200，**已迁** |
| 自定义监控接口全 404 | 探错版本，对象在 `v1alpha2`，**集群级已迁** |

---

## 附录：历史

第 1–120 轮的逐轮叙述已从本文移除（约 2800 行）。需要过程细节时：

```bash
git log --oneline -- docs/plans/area-migration-plan.md   # 每次整理的提交
git show <commit>^:docs/plans/area-migration-plan.md     # 整理前的完整正文
```

**当前有效的结论都已在上文**：不变量见 §4，缺口见 §6，防缺规则见 §7。

> 注意：旧分析文档里引用的 `area-migration-plan.md:行号` 与 `§5.x` 已随本次整理失效，
> 结论请以 §4/§6/§7 为准。`gap_check.py` 与 `verify.py` 的注释已同步更新。
