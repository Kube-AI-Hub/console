# TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01 卷与配额 · 表格与可读性

- **用例 ID**: `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-storage` / `shared-storage` `quota`
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/volumes`
- **需求**: `prd/cluster-storage/shared-storage/quota.md`

## 产品功能

卷页八列表格齐全、每行有配额与操作按钮，且表格文字在深色主题下可读。

### 关联需求

- `prd/cluster-storage/shared-storage/quota.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/quota.md`](../../../../prd/cluster-storage/shared-storage/quota.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01** — Given 集群有两个共享卷，When 打开卷页，Then 表格出现两行，八列表头齐全，每行的配额、已用、使用率、inodes、挂载节点都有值，行尾有「调整配额」按钮。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-03** — Given 卷页已渲染，When 测量表头与表格正文的对比度，Then 正文 ≥ 4.5:1，次要文字 ≥ 3:1，且没有未翻译 key。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/quota.md`](../../../../design/cluster-storage/shared-storage/quota.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/quota.md`](../../../../prd/cluster-storage/shared-storage/quota.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，在表格里核对每个共享卷的配额与用量


**Independent Test**：打开 `/clusters/default/juicefs-storage/volumes`，核对表头为卷 / 目录 / 配额 / 已用 / 使用率 / inodes / 挂载节点 / 操作八列；每行的配额与 `kubectl get pv <name> -o jsonpath='{.spec.capacity.storage}'` 一致；目录为嵌套卷时显示「位于 model-cache 内」。

### US3 - 作为集群运维，在深色主题下看清表格里的每一个字段

## 验收场景
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01** — Given 集群有两个共享卷，When 打开卷页，Then 表格出现两行，八列表头齐全，每行的配额、已用、使用率、inodes、挂载节点都有值，行尾有「调整配额」按钮。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02** — Given 打开某个卷的配额弹窗，When 输入低于已用的容量，Then「确定」不可用并提示下限；When 输入更大的容量并确定，Then 表格配额更新、PV 的 `spec.capacity` 与 JuiceFS quota 同步更新。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-03** — Given 卷页已渲染，When 测量表头与表格正文的对比度，Then 正文 ≥ 4.5:1，次要文字 ≥ 3:1，且没有未翻译 key。
## 设计目标
- 表格上的配额必须是**会被驱动保持的值**：PV 的 `spec.capacity`。JuiceFS 目录 quota 只是同一件事的运行时表现。
- 写操作要能被解释：弹窗里写清「改的是哪个目录、会同时更新 PV 容量与目录配额、失败会回滚」。
- 不能出现「表格说 5TiB、实际是 6TiB」这种静默漂移；statfs 未刷新时明确标注。
## 约束与边界
- 只管理 PV 级目录，不管理任意子目录。
- `Released` 的卷（claim 已删除）不展示：它们没有可管理的对象，给出按钮只会误导。
- 缩小配额时不能低于当前已用；后端会拒绝，前端先拦一次并给出具体数字。
## UI 交互设计
- 表格八列，操作列固定在最右；窄屏横向滚动。
- 配额弹窗：顶部显示目录、已用（含百分比）、当前配额；中间是数字输入 + 单位下拉（GiB / TiB）；底部是影响说明。
- 提交中禁用按钮；失败时弹窗内显示后端返回的原因，并保持输入不变。
## 文案与校验
| key | 中文 | 用途 |
| --- | --- | --- |
| `SHARED_STORAGE_VOLUME` | 卷 | 表头 |
| `SHARED_STORAGE_DIRECTORY` | 目录 | 表头 |
| `SHARED_STORAGE_CAPACITY` | 配额 | 表头 |
| `SHARED_STORAGE_USED` | 已用 | 表头 |
| `SHARED_STORAGE_USAGE` | 使用率 | 表头 |
| `SHARED_STORAGE_INODES` | inodes | 表头 |
| `SHARED_STORAGE_NODES` | 挂载节点 | 表头 |
| `SHARED_STORAGE_SET_QUOTA` | 调整配额 | 行内按钮 / 弹窗标题 |
| `SHARED_STORAGE_QUOTA_BELOW_USAGE` | 新配额不能低于当前已用的 {used} | 校验 |
| `SHARED_STORAGE_QUOTA_INVALID` | 请输入大于 0 的容量 | 校验 |
| `SHARED_STORAGE_QUOTA_DRIFT` | 待刷新 | 配额列标注 |
校验：数字必须为正；单位只能是 GiB / TiB；换算后的字节数必须大于 `usedBytes`。
## 边界情况
- 输入为空或非数字：确定不可用。
- 输入等于当前配额：允许提交，Job 幂等。
- 后端 Job 失败：PV 容量回滚，弹窗显示 CLI 的原因。
- 卷未挂载（`usedBytes` 为 0）：仍可改配额。
## 功能需求
- **FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01** — 系统 MUST 以 PV 的 `spec.capacity` 作为表格里的配额值。
- **FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02** — 系统 MUST 在提交配额时同时更新 PV 容量与 JuiceFS 目录配额，失败时回滚 PV 容量。
- **FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-03** — 系统 MUST 使用主题 token 渲染表格文字，正文对比度 ≥ 4.5:1。
## 成功标准
- **SC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01** — 配额提交到表格更新 ≤ 10 秒。
- **SC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02** — 改完后重启挂载该卷的 Pod，配额不回退。
## 明确不做
- 不做卷的创建、删除、迁移。
- 不做子目录级配额。
- 不在页面上直接调用 `juicefs` CLI（由后端的一次性 Job 执行）。
## 假设
- 后端 `PUT /kapis/juicefs.kubesphere.io/v1alpha1/volumes/{pv}` 可用。
- 配额 Job 的镜像与 Secret 已在集群里。
## 验收用例
- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01`
- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02`

**Independent Test**：在同一页面测量表头、卷名、目录、配额、已用、百分比文字的对比度，正文 ≥ 4.5:1；页面不出现未翻译 key。

## 前置与配置

- 已登录，且在 default 集群
- 集群至少有一个共享卷

## 测试步骤

1. 打开 /clusters/default/juicefs-storage/volumes
2. 读取表头
3. 读取每一行的卷名、目录、配额、已用、使用率、inodes、挂载节点与操作列
4. 对表格区做对比度审计（阈值 4.5:1）

## 期望结果

- 表头为卷 / 目录 / 配额 / 已用 / 使用率 / inodes / 挂载节点 / 空
- 每行配额显示为 TiB/GiB 而非原始字节数
- 嵌套卷的目录下有「位于 model-cache 内」
- 每行操作列有「调整配额」
- 对比度审计返回空列表

## 失败排查

- 配额显示成字节数说明 Table 用了 renderCell 而不是 column.render
- 文字看不清时确认 SCSS 用了 token

## 产品改版后如何更新自动化

- 列顺序变化时改 pages/juicefs_storage.py
