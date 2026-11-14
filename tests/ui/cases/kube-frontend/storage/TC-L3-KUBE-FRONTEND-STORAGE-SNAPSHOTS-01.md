# TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01 卷快照与快照类型 · 集群级列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `snapshots`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/volume-snapshots`
- **需求**: `prd/kube-frontend/storage/snapshots.md`

## 产品功能

集群级「存储卷快照」跨项目列出快照（名称/项目/状态/容量/快照类型/创建时间），「快照类型」列出 VolumeSnapshotClass（名称/驱动/删除策略/参数个数/创建时间）；未安装 CSI 快照 CRD 时两页给出明确说明而不是空表。

### 关联需求

- `prd/kube-frontend/storage/snapshots.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/snapshots.md`](../../../../prd/kube-frontend/storage/snapshots.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01** — 已知集群已安装 CSI 快照 CRD，当打开 `/volume-snapshots`，则显示跨项目卷快照表（名称、项目、状态、容量、快照类型、创建时间），行数等于 `min(20, 总数)`，名称链到该快照在项目控制台的详情、项目列链到该项目的卷快照列表；当打开 `/volume-snapshot-classes`，则显示快照类型表（名称、驱动、删除策略、参数个数、创建时间），行数等于 `min(20, 总数)`；已知集群未安装 `snapshot.storage.k8s.io/v1`，则两页都显示「本集群未安装快照 CRD」的明确说明，而不是空表。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/snapshots.md`](../../../../design/kube-frontend/storage/snapshots.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/snapshots.md`](../../../../prd/kube-frontend/storage/snapshots.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在集群视角查看卷快照与快照类型 (Priority: P1)

作为 **集群运维**，我希望 **在一个跨项目的列表里看到全部卷快照的归属与状态，并看到集群的快照类型**，以便 **不必逐个进入项目排查「哪个项目的快照没就绪」，也能确认快照驱动是否配置正确**。

**Independent Test**：打开集群级卷快照页，核对六列与项目链接；打开快照类型页，核对五列；当集群没有装快照 CRD 时，两页都给出明确说明。

## 前置与配置

- 已登录，且是 host 集群的集群管理员（集群级页面，无 workspace / 项目段）
- 用例用 BFF 探测 snapshot.storage.k8s.io/v1 是否存在；存在时临时创建一条 tc-e2e- VolumeSnapshotClass，用例结束无条件删除

## 测试步骤

1. 用发现接口判断快照 CRD 是否存在，并读取两处 kapis 集合的总数
2. 打开 /kube-frontend/clusters/<cluster>/volume-snapshots，等待主区离开 loading
3. 读取表头与行数，核对行句柄 <项目>/<名称>、项目列与名称链接
4. 打开 /kube-frontend/clusters/<cluster>/volume-snapshot-classes，读取表头与行数
5. 核对临时创建的快照类型行含驱动与删除策略

## 期望结果

- CRD 存在且集合非空时：两页 data-ai-state=ready，行数等于 min(20, total)，快照表头为 名称/项目/状态/容量/快照类型/创建时间，类型表头为 名称/驱动/删除策略/参数个数/创建时间
- 快照行句柄为 <项目>/<名称>，项目列文本等于项目，名称链接指向 /projects/<项目>/volumesnapshots/<名称>
- 临时快照类型出现在列表且参数个数为 1
- CRD 存在但集合为空时：data-ai-state=empty 且显示「暂无存储卷快照」/「暂无快照类型」
- CRD 不存在时：两页都显示「本集群未安装快照 CRD」的说明块（*-crd-missing），不渲染空表

## 失败排查

- 页面进入 error：先确认 BFF 的 KS_API_MODE 是否为 kapis；kubectl-proxy harness 不提供跨项目 kapis 列表
- CRD 已装但页面显示未安装：discovery 只把 404 当作未安装，403/5xx 会走错误面板
- 行数少于 total：检查分页参数 limit=20 是否透传，以及是否被搜索关键字过滤

## 产品改版后如何更新自动化

- 列变化时改页面 schema 与 setup 里的表头常量
- 快照 CRD 安装情况变化时，用例的 installed 分支会自动切换，无需改断言
