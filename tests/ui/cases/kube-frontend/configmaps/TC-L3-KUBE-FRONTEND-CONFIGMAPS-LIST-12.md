# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-12 每页档位收口 · 一次读全的列表在客户端切片

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-12`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{CLUSTER}/components`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

灰度发布、集群成员、系统组件、自定义资源及其实例、多集群、持久卷这 7 个列表都有每页条数选择器（10/20/50/100）；一次读全后在客户端切片，分页器显示的总数仍是全部行数。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-12** — 已知灰度发布、集群成员、系统组件、自定义资源、自定义资源实例、多集群与持久卷这 7 个列表在集群里有多于一页的数据，当打开页面，则渲染每页条数选择器（10/20/50/100），首屏只渲染当前页的行（默认 20），分页器显示的总数等于接口返回的全部行数；切换每页条数后回到第 1 页并按新档位切片；翻页只换窗口、不重新请求；数据变少时页码收敛到最后一页，不停在空页。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，按创建时间看最近的配置


**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

## 前置与配置

- 已登录，host 集群；系统组件接口可读且条数多于一页（本环境约 47 条）

## 测试步骤

1. 用 API 读系统组件，记录总数 N
2. 打开 /kube-frontend/clusters/host/components，等列表就绪
3. 核对首屏行数 = min(N, 20)，分页器文案含「共 N 条」
4. 点「下一页」，核对首屏第一行换成第 21 行对应的组件，行数 = N - 20（不足一页时）
5. 点每页条数选择器选 50，核对行数 = min(N, 50) 且回到第 1 页

## 期望结果

- 选择器句柄 components:page-size 存在，选项 10/20/50/100
- 首屏只渲染当前页的行；总数来自全部行（不是当前页条数）
- 翻页不重新请求（同一份数据换窗口）；切换档位回到第 1 页

## 失败排查

- 分页器显示的总数等于当前页条数：total 取了切片后的长度
- 选了档位行数不变：pagination.pageSize 仍写常量，或列表没接 onPageSizeChange
- 翻页后空白：页码没有夹住（数据变少时停在空页）

## 产品改版后如何更新自动化

- 句柄：components:page-size；行 data-ai-row；分页器文案在 ResourceList 内
