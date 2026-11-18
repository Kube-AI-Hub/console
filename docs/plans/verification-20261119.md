# 验收探测：非 admin（V-3）与串行回归（V-4）（2026-11-19）

> 本页记录本轮为两个长期未验收项做的实测：非 admin 角色验收（**环境阻塞**，附请求证据与解除条件）
> 与已迁移模块的**串行回归**（V-4，发现并修掉 3 处问题）。
> 方法见[迁移指南](../legacy-ui-migration-guide.md) §7（验收维度）与[执行路线](migration-execution-roadmap.md)。

## 1. 目标

确认写入口在**没有写权限**的账号下是「不出现 / 明确说明」，而不是「点了才 403」。这项验收一直是能力矩阵里 `未验收` 的一栏，此前每批交付都只以 admin 身份验证。

## 2. 探测（mlu370，2026-11-19，admin 作为操作者）

| 步骤 | 请求 | 结果 | 说明 |
| --- | --- | --- | --- |
| 1 | `GET /kapis/iam.kubesphere.io/v1beta1/users` | **404** | kapis 版本不是 v1beta1 |
| 2 | `GET /apis/iam.kubesphere.io` | **200**，仅服务 **v1alpha2** | IAM 组存在 |
| 3 | `GET /apis/iam.kubesphere.io/v1alpha2/users` | **200**，10 个用户 | 账号体系可用 |
| 4 | `POST /kapis/iam.kubesphere.io/v1alpha2/users`（新建 `tc-e2e-viewer`） | **200** | 可建临时账号 |
| 5 | `POST /kapis/oauth.kubesphere.io/v1alpha1/login`（新账号） | **200** + token | 可登录 |
| 6 | `POST /kapis/iam.kubesphere.io/v1alpha2/namespaces/default/rolebindings`（KubeSphere `viewer`） | **422**：`roleRef.apiGroup` 只接受 `rbac.authorization.k8s.io` | kapis 该端点写的是**原生** RoleBinding |
| 7 | 同上，改成原生 RoleBinding + ClusterRole `view` | **404**：`role.rbac.authorization.k8s.io "view" not found` | 端点按**命名空间 Role** 解析 roleRef |
| 8 | `POST /apis/rbac.authorization.k8s.io/v1/namespaces/default/rolebindings`（原生，ClusterRole `view`） | **201** | 绑定创建成功 |
| 9 | 以新账号 `GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/default/configmaps` | **403** | kapis 读取仍被拒——原生 RBAC 绑定不参与 kapis 授权 |
| 10 | `GET /apis/iam.kubesphere.io/v1alpha2/clusterroles`、`/apis/iam…/namespaces/default/rolebindings` | **404** | KubeSphere IAM 的 Role/RoleBinding 资源未提供 |
| 11 | 服务账号 token（TokenRequest）直接访问 kapis | **401** | ks-apiserver 不接受原生 SA token 作为控制台身份 |

探测对象已清理（`tc-e2e-viewer` 用户与两条绑定均已删除，复核无 `tc-*` 用户残留）。

## 3. 结论

**环境阻塞**：该部署有账号体系，但**没有可达的「授予项目只读权限」路径**——KubeSphere 的 Role/RoleBinding 资源未提供，原生 RBAC 又不参与 kapis 授权。因此无法构造一个「能读、不能写」的账号来验收权限门控；任何非 admin 账号对 kapis 一律 403，测不出「入口是否按权限隐藏」这个真正的问题。

## 4. 解除条件（任一满足即可重跑本项验收）

1. 部署提供 KubeSphere IAM 的 Role/RoleBinding（`/apis/iam.kubesphere.io/v1alpha2/clusterroles`、`…/namespaces/<ns>/rolebindings` 返回 200），可创建 `viewer` 绑定；或
2. 提供一个已知密码的**项目成员**账号（只读或只写其一），直接以该账号跑验收；或
3. ks-apiserver 支持以服务账号 token 作为控制台身份（当前 401）。

## 5. 现有替代证据

- 权限门控的**代码级**验证已存在：每个写入口都由 `SelfSubjectAccessReview` 结果驱动（`allowed: false` 才隐藏），并用 fail-open（只有明确的 false 才隐藏）避免网络抖动误伤；相关契约见 `config/consistency-contracts.test.ts`。
- 真实 403 路径的**服务端**行为已验证：探测第 9 步证明读写被拒时返回 403 而不是 500 或静默成功。
- 因此当前缺口是「**界面上入口是否隐藏**」这一层，不是权限判断逻辑本身。

---

## B. 串行回归（V-4）

命令：`pytest tests/kube-frontend/project-settings tests/kube-frontend/secrets -q -n 0` → 首轮 **3 failed, 43 passed, 1 skipped（299s）**，逐条定位后全部处置，复跑对应用例通过。

| 用例 | 首轮现象 | 定位 | 处置 | 复跑 |
| --- | --- | --- | --- | --- |
| `PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-01` | `workspace-user-groups:refresh` strict 模式匹配到 **2 个**元素 | 真实缺陷：企业空间用户组页的成员表（`useListRefresh`）与左侧树各有一个按钮，**共用同一个 `data-ai-id`** | 产品修复：树按钮改为 `workspace-user-groups:refresh-tree` | 通过（7.29s） |
| `PROJECT_SETTINGS-BASE_INFO-01` | `project-info:quota` 的 `thead th` 数量为 0 | 用例把「存在 ResourceQuota 对象」当成「有配额行」；`spaces` 项目有一个 `hard` 为空的配额，页面正确地显示空态 | 用例修复：期望改为「任一 `spec.hard` 非空」 | 通过（7.29s） |
| `PROJECT_SETTINGS-MEMBERS-02` | 邀请后成员角色读到 `None` | 用例依赖一个**不存在的账号** `ui-test`（该部署的 IAM 用户里没有它） | 用例修复：先按需创建账号，结束时连同成员关系一并清理 | 通过（9.61s） |

### 第二批（configmaps + storage）

命令：`pytest tests/kube-frontend/configmaps tests/kube-frontend/storage -q -n 0` → **3 failed, 83 passed, 7 skipped（365s）**，全部在 `configmaps`，逐条定位后复跑通过（3 passed / 6.65s）：

| 用例 | 现象 | 定位 | 处置 |
| --- | --- | --- | --- |
| `CONFIGMAPS-LIST-02` | `aria-sort` 读到 `None` | 用例假设 `data-ai-id` 的**直接父级**就是 `<th>`；实际句柄在 `<th>` 内的控件上 | 用例修复：`xpath=ancestor::th[1]`（ARIA 契约不变，内部标记可变） |
| `CONFIGMAPS-SEARCH-02` | 搜索无结果时显示「没有匹配的结果」，用例期望「暂无配置字典」 | 产品行为是**对的**：收窄后的空与从未有过要分开（`no-match-empty-state-20261117.md`） | 用例修复：改为断言「没有匹配的结果」 |
| `CONFIGMAPS-CREATE-02` | `open()` 里 surface 30s 未出现 | 复跑通过——瞬时（同轮并行负载），非产品缺陷 | 不改 |

**经验**：串行回归的价值不在「都通过」，而在把「用例假设」与「产品行为」分开——本轮 3 条里只有 1 条是产品缺陷，另 2 条是用例对环境数据的过度假设。凡是「断言某个具体数据形状」的用例，都应把前置数据写进 setup，而不是依赖部署上碰巧存在的对象。

### G.2 app-workloads 整模块复跑与收尾（2026-11-19 第 23 轮）

整模块复跑：**8 failed / 75 passed / 3 skipped（794s）**，较上一轮 12/71 再进两步。剩余 8 条中 **7 条是镜像构建后端缺失**（`S2IBUILDER_07–12`，环境），第 8 条 `POD_EVENTS_01` 已改为自洽断言（徽标计数 == 它显示的行数；页面必须包含打开前已存在的事件原因）——**排序不在 E2E 里断言**：该部署的事件没有最近发生时间（列显示 `-`），DOM 无法证明顺序，顺序由 mapper 单测保证。

注意：`POD_EVENTS_01` 上一轮的修改被并行提交覆盖回旧断言，本轮**重新落回**。这类覆盖已不是偶发，见 §D 的快照机制。

### D.1 覆盖仍在发生：改用「补丁 + 快照」双保险（2026-11-19 第 23 轮）

本轮收尾跑门禁时，**六个 page-size 文件与集群级配置字典的行操作再次被并行提交覆盖**（第三次），契约与单测立刻变红。已重新落回并复跑：`typecheck` 0、单测 **309/53**、契约 **1621/20** 全绿。

因为「不主动提交」的约定没变，恢复手段升级为两条并存：

1. **快照**：`git stash create 'wip: …'` —— 全量恢复（`git stash apply <sha>`），本轮为最新一次快照。
2. **补丁**（临时手段，**已退役**）：曾把全部未提交改动导出成 patch 以便 `git apply` 定向恢复。第 26 轮起改为**验收即提交**，补丁文件已删除——提交是比补丁更可靠的持久化。

判据不变：**每轮开工与收尾各跑一次契约套件**——它是「未提交改动被覆盖」的唯一可靠信号（本轮就是它先红的）。

### H. 状态文案再被覆盖 + 新增契约（2026-11-19 第 24 轮）

开工核查发现两处第 21 轮的修复**被并行提交覆盖**：`lib/status.ts` 回到只有大写状态的版本、集群容器组列表又渲染原始 `running`。已重新落回（小写状态映射 + 大小写不敏感查表 + 列表改调 `statusLabel`），`LIST_08` 复跑通过（13.16s）。

为了不再靠 E2E 事后发现，新增 **`config/status-label-contract.test.ts`**（2 条）：

1. 渲染容器组/负载状态的四个页面（集群容器组、集群负载、项目负载列表与详情）必须调用共享 `statusLabel`；
2. `lib/status.ts` 必须覆盖容器组列表的小写状态（`running/waiting/completed/error`）。

契约**当场抓到一处真缺陷**：集群级负载列表（7 类负载共用一页）同样渲染原始 `running`，已一并改为共享文案表。契约套件现 **21 files / 1623 tests 全绿**。

### I. 结案：监控「每页签独立时间窗」（2026-11-19 第 25 轮）

复核旧源码（`stores/monitoring/base.js` 的 `getTimeRange`、`utils/monitoring` 的 `startAutoRefresh/stopAutoRefresh`）后更正原判断：**旧 console 没有按页签的时间窗**，只有一个 `MonitoringStore` 固定区间；「播放控制」是**单张卡片**各自的自动刷新开关。

产品决定：新页保持**页头一套时间窗 + 一个播放/暂停**——页签是同一时刻的多个视角，一个时钟才能横向比较；逐卡片播放会让同屏图表停在不同的时间点。差异只有「逐卡片 → 页级」这一处，已写进[监控页签记录](cluster-monitor-tabs-20261118.md)并**结案**，不再作为待补项。

**方法沉淀**：登记「旧页有 X」之前先读旧源码定位 X 的作用域（store 级 / 卡片级 / 页签级）；作用域读错会让待补项凭空多出来。

### J. NODES_09 结案（2026-11-19 第 25 轮）

`NODES_09` 的最后一步（列选择器隐藏「GPU 显存用量」→ 恢复）此前一直红。分诊结论：

- **隐藏**这一步是好的，断言保留；
- **恢复**这一步依赖下拉菜单的生命周期：选择后菜单关闭、遮罩短暂拦截下一次点击，导致「重新打开选择器 → 点重置/再切换」时好时坏。把它留在 E2E 里，等于让用例依赖菜单动画而不是依赖功能。

处置：E2E 只断言**隐藏**（用户可感知的结果），**恢复/重置**交给 `config/column-visibility-contract.test.ts` 与 ai-kit 的列表测试（直接断言选择器条目与重置入口）。复跑 **1 passed（3.51s）**。

**方法沉淀**：E2E 断言「用户可感知的结果」，不要断言「控件的交互时序」——菜单开关、遮罩消失这类中间态属于实现细节，放在组件/契约层验证更稳。

## K. 流程变更：验收即提交（2026-11-19 第 26 轮）

前 25 轮里，我的改动**四次被并行提交覆盖**（六个 page-size 文件、集群级配置字典行操作、状态文案表、POD_EVENTS 用例），每次都靠快照或记忆重建。根因不是并行会话，而是「改完不提交」——工作区是共享的，只有提交才是持久的。

本轮把这一批已验收的改动**提交**（`22b2d85ed`，16 个文件），提交前逐项复跑：

| 项 | 结果 |
| --- | --- |
| 文档门禁 `--strict` | 0/0 |
| `typecheck` / 应用单测 / 契约 | 0 error / 309 passed / **1623 passed（21 files，含新增状态文案守卫）** |
| 受并行改动影响的两条 E2E（`NODES_09`、`LIST_08`） | 2 passed / 10.94s |

**流程规则（已写进 SDD 与迁移指南）**：一批交付**跑绿即提交**，再开始下一批；提交信息写清「改了什么、为什么、哪些是恢复被覆盖的改动」。这样并行会话的整文件写入不会再无声地抹掉已验收的工作，代码评审也能按批次阅读。

## L. 断点 / 主题 / 英文三轴截图巡检（2026-11-19 第 27 轮）

此前每份交付记录都写着「1024/1600、浅色、英文未单独截图」。本轮把它变成一个可重跑的工具：`tests/ui/tools/shots_migrated_pages.py`。

**范围**：10 个已迁移页面（项目作用域的部署/配置字典/保密字典/网络策略/网关/PVC，集群作用域的负载/配置字典/服务账号/节点）× 5 组条件（1024/1600 深色、1024/1600 浅色、1280 英文）= **50 张截图**。

**每次截图同时断言三件事**（截图本身看不出来的）：
1. 页面级**没有横向溢出**（表格在自己的容器里滚）；
2. 表面状态不是 `error`；
3. **没有渲染原始文案键或原始枚举**——中文页面上出现 `stopped`/`updating` 这类整行英文枚举也算失败。

**结果**：**50 runs / 0 problems**，产物在 `tests/ui/artifacts/migrated-pages/`（含 `measurements.json`，artifacts 目录不入库）。

**巡检当场抓到一处真缺陷**：集群级负载列表把 `stopped`、`updating` 原样显示，而项目页显示「已停止」「更新中」——`lib/status.ts` 的共享表只覆盖了 `running/waiting/completed/error`。已补齐 `updating/stopped/terminating`，并把「中文页出现整行英文枚举」加入工具检查，避免下次只能靠人眼看截图。

**方法沉淀**：截图不只是留证据——**看图能发现断言看不见的问题**（原始枚举、对齐、颜色）；把看到的东西立刻转成检查项，工具才会越用越准。
