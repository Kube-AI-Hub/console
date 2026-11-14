# 访问控制根路径入口

> 补 `/kube-frontend/access` 空白页。台账见[能力矩阵](capability-matrix.md) CHECK-05。未提交。

## 范围

侧栏「访问控制」与书签 `/kube-frontend/access` 原先落到无页签的空白布局。老 console 用 `getIndexRoute` 把 `/access` 指到 `accounts`；新 UI 对应页是 `users`。本批只补根路径入口，不改用户表本身。

## 实现

- `kube-frontend.access/index.tsx`：`beforeLoad` redirect 到 `/kube-frontend/access/users`（与应用商店根路径同一写法）。
- 区域 `defaultPage` 仍为 `users`；侧栏仍指向 `/kube-frontend/access`，由 redirect 落到用户表。

## 验收

| 项 | 结果 |
| --- | --- |
| 打开 `http://localhost:5178/kube-frontend/access` | URL 变为 `/kube-frontend/access/users`，三页签可见，「用户」高亮，列表 ready |
| 侧栏点「访问控制」（从集群列表返回） | 同样落到用户表 |
| 页签 y 对齐 | 用户 / 平台角色 / 企业空间均为 y=88（1280）、间距 4px |
| `check_docs.py --strict` access-control | errors=0 warnings=0 |
| `TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-02` | 1 passed（2.02s） |
| 构建 | `pnpm --filter @kube-ai-hub/console-next build` |

截图：`docs/plans/assets/access-landing-20261115/`。

未上 B200：只影响本地 5178 新 UI，不改 ks-console / server / charts。
