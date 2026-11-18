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