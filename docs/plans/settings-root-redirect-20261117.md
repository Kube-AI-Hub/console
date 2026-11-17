# `/kube-frontend/settings` 根路径空白（2026-11-17）

## 1. 现象（实测）

| 路径 | body 长度 | 内容 |
| --- | --- | --- |
| `/kube-frontend/settings` | **65** | 只有外壳与侧栏，**没有内容** |
| `/kube-frontend/platform` | 123 | 「页面不存在」（该根不是路由） |
| `/kube-frontend/monitoring` | 123 | 只有外壳（该根不是路由，monitoring 是项目作用域） |
| `/kube-frontend/clusters` | 254 | 集群列表，正常 |

## 2. 根因

`kube-frontend.settings/route.tsx` 是**布局**：它按 segment 找 area 渲染页签，再 `<Outlet/>`。
根路径没有 segment → 没有 area → 没有页签；同时**没有 index 子路由** → `<Outlet/>` 渲染空。
于是整页只剩外壳。

`access` 与 `apps-manage` 早就有同样的 index 重定向（注释里写明「缺 index 会渲染没有页签的空壳」），
`settings` 漏了。

## 3. 修复

新增 `routes/kube-frontend.settings/index.tsx`：

```tsx
export const Route = createFileRoute('/kube-frontend/settings/')({
  beforeLoad: () => { throw redirect({ to: '/kube-frontend/settings/info' }); },
  component: Redirecting,
});
```

目标页取 `platform-settings` area 的 `defaultPage: 'info'`（与 registry 保持一致）。

## 4. 验证

```
url: /kube-frontend/settings/info
body len: 221      ← 修复前 65
body: 名称 | - | 平台描述 | - | 控制台地址 | - | 外观 | 主题模式 深色/浅色 | 色调 …
```

`routeTree.gen.ts` 由 `vite build` 重新生成（新路由已出现在生成文件里）；`tsc` 0 错误；`vite build` ✓。

## 5. 更正：那三个「只渲染外壳」的根其实是正常的 404

上一版这里写着「`/platform` 与 `/monitoring` 表现不一致，后者只渲染外壳」——**这是错的**，
错在只量了 body 长度（123 字符）而没有读文本。补测后：

| 路径 | body | 含「页面不存在」 | 结论 |
| --- | --- | --- | --- |
| `/kube-frontend/workspaces` | 123 | **是** | 正常 404 |
| `/kube-frontend/platform` | 123 | **是** | 正常 404 |
| `/kube-frontend/monitoring` | 123 | **是** | 正常 404 |
| `/kube-frontend/settings` | 221 | 否（已重定向到 info） | 修复生效 |

catch-all 路由 `/# `/kube-frontend/settings` 根路径空白（2026-11-17）

## 1. 现象（实测）

| 路径 | body 长度 | 内容 |
| --- | --- | --- |
| `/kube-frontend/settings` | **65** | 只有外壳与侧栏，**没有内容** |
| `/kube-frontend/platform` | 123 | 「页面不存在」（该根不是路由） |
| `/kube-frontend/monitoring` | 123 | 只有外壳（该根不是路由，monitoring 是项目作用域） |
| `/kube-frontend/clusters` | 254 | 集群列表，正常 |

## 2. 根因

`kube-frontend.settings/route.tsx` 是**布局**：它按 segment 找 area 渲染页签，再 `<Outlet/>`。
根路径没有 segment → 没有 area → 没有页签；同时**没有 index 子路由** → `<Outlet/>` 渲染空。
于是整页只剩外壳。

`access` 与 `apps-manage` 早就有同样的 index 重定向（注释里写明「缺 index 会渲染没有页签的空壳」），
`settings` 漏了。

## 3. 修复

新增 `routes/kube-frontend.settings/index.tsx`：

```tsx
export const Route = createFileRoute('/kube-frontend/settings/')({
  beforeLoad: () => { throw redirect({ to: '/kube-frontend/settings/info' }); },
  component: Redirecting,
});
```

目标页取 `platform-settings` area 的 `defaultPage: 'info'`（与 registry 保持一致）。

## 4. 验证

```
url: /kube-frontend/settings/info
body len: 221      ← 修复前 65
body: 名称 | - | 平台描述 | - | 控制台地址 | - | 外观 | 主题模式 深色/浅色 | 色调 …
```

`routeTree.gen.ts` 由 `vite build` 重新生成（新路由已出现在生成文件里）；`tsc` 0 错误；`vite build` ✓。

 一直在工作，是**我的判据不完整**——body 短不等于页面空。
**教训**：判断「页面是否空白」要同时看长度与文本，长度只能当筛选条件。

## 6. 反思

| # | 规则 |
| --- | --- |
| 1 | **布局路由必须配 index**：只有 `<Outlet/>` 的布局在根路径必然空白 |
| 2 | **同一类修复要全局搜一遍**：`access`/`apps-manage` 已有 index，`settings` 漏了——说明「有先例」不等于「都照做」 |
| 3 | **空白页要用 body 长度量**，不能只看「没报错」 |
