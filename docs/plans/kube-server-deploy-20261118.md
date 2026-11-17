# ks-apiserver 部署（节点加入 + 权限检查，2026-11-18）

> B200 实测部署记录。镜像基于 **B200 现网基线 85db2a5** + 本次两个 kube-server 提交，避免把未验证的 develop 前进提交带上生产。

## 1. 提交

| 仓库 | 提交 | 内容 |
| --- | --- | --- |
| kube-server | d472dec55 | 节点 join 命令接口 + IAM self access review |
| kube-server | f0643379e | 已认证用户可执行 self access review（否则 view-only 用户检查被 403，控制台 fail-open） |
| kube-server 部署分支 | deploy/ks-apiserver-node-join-20261118（基于 85db2a5 + 上述两提交） | 已 push 到 origin |
| console | f499ca0b5 | 新 UI 迁移全量提交（含本次权限/节点弹窗/文档） |

## 2. 镜像与部署

- 镜像：`dockerhub.kubekey.local/kube-ai-hub/ks-apiserver:node-join-20261118c`
- 摘要：`sha256:24cd78cbbbcb78cda1209e6198a1d57de3e21c34795c45449cb6376984ac9cf0`
- 集群：B200（gpu01/gpu02/sg），命名空间 kubesphere-system，Deployment ks-apiserver
- 方式：`ssh sgb000 kubectl -n kubesphere-system set image deploy/ks-apiserver ...`，rollout 完成，Pod ready。

### 2.1 首次失败与回滚（重要）

- 第一次用**本地 develop HEAD（f31a…）**构建并部署 `node-join-20261118`，Pod 起来后 **admin 登录全部 incorrect password**；新接口本身可访问，但认证链路不可用。
- 立即回滚到原镜像 `full-20261113`，登录恢复。
- 根因判断：本地 develop 比 B200 现网基线多 4 个未验证提交，构建不能直接取本地 HEAD。改为在 **85db2a5 + 仅本次两提交** 上构建，部署 `node-join-20261118c` 后登录正常。
- 结论：**生产构建必须对齐现网基线，只 cherry-pick 本次改动**；不要用本地 develop 整体构建。

## 3. 验证

| 项 | 结果 |
| --- | --- |
| admin 登录 | 200，token 正常 |
| IAM self access review（admin） | 200 `{"allowed":true,"reason":"...platform-admin..."}` |
| 节点 join 命令 | 200，返回 kubeadm join / 到期时间；测试创建的 bootstrap token 已删除 |
| viewer（项目 default 只读）IAM | deployments/nodes create 均 `{"allowed":false}` |
| viewer UI | 部署页创建入口 disabled + 原因「当前账号在该项目没有创建部署的权限」；节点页「添加节点」隐藏 |
| E2E TC-NODES-12 | **1 passed / 5.75s**（真实后端正向 join 命令） |
| 权限 E2E（5 条） | **5 passed / 73.36s**（测试 mock 已改为同时覆盖 IAM 与旧 SSAR 两路） |

## 4. 变更与清理

- 测试更新：`tests/ui/helpers/access_review.py` 统一权限 mock；5 条权限用例改为按新 IAM 契约 mock。
- 临时 viewer 用户与 RoleBinding 已删除；bootstrap token 无残留。
- 回滚镜像 `full-20261113` 保留在 Deployment 历史（revision 51 之前），如需回滚可 set image 回去。

## 5. 后续

| 项 | 状态 |
| --- | --- |
| 把部署分支合并回 develop（先验证 f31a 的兼容性） | 待办 |
| 成员集群（mlu370）ks-apiserver 同步升级 | 未做 |
| console 前端镜像部署到 ks-console | 未做（本轮只部署 kube-server） |
