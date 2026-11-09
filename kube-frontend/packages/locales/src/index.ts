/**
 * UI copy for the console rewrite.
 *
 * One object per language with the same keys. The `Dictionary` type is derived
 * from the reference language, so adding a key to `zh` and forgetting `en`
 * fails typecheck instead of shipping a raw key to a user.
 *
 * No i18n library: the app is Chinese-first, the key set is small, and a
 * dependency that resolves strings at runtime cannot be type-checked the way
 * this can. Swapping in one later only touches `translate`.
 */

export const zh = {
  'app.name': '智算平台',
  'app.skipToContent': '跳到主要内容',
  'nav.primary': '主导航',
  'nav.toggle': '展开或收起导航',

  'common.loading': '加载中',
  'common.retry': '重试',
  'common.cancel': '取消',
  'common.confirm': '确认',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.create': '创建',
  'common.save': '保存',
  'common.search': '搜索',
  'common.refresh': '刷新',
  'common.close': '关闭',
  'common.name': '名称',
  'common.description': '描述',
  'common.actions': '操作',
  'common.more': '更多操作',
  'common.selected': '已选择 {count} 项',
  'common.page': '第 {page} 页',
  'common.empty': '暂无数据',

  'error.title': '加载失败',
  'error.unauthorized': '没有权限执行该操作',
  'error.notFound': '资源不存在',
  'error.network': '网络异常，请稍后重试',
  'error.unknown': '未知错误',

  'configmaps.title': '配置字典',
  'configmaps.description': '管理项目内的 ConfigMap 资源。',
  'configmaps.searchPlaceholder': '按名称搜索',
  'configmaps.column.keys': '键',
  'configmaps.column.createdAt': '创建时间',
  'configmaps.empty.title': '暂无配置字典',
  'configmaps.empty.description': '创建第一个配置字典以挂载到工作负载。',
  'configmaps.action.create': '创建',
  'configmaps.action.editYaml': '编辑 YAML',
  'configmaps.action.delete': '删除',
  'configmaps.action.bulkDelete': '批量删除',
  'configmaps.confirm.delete': '确认删除该配置字典？',
  'configmaps.confirm.bulkDelete': '确认删除所选配置字典？',
  'configmaps.deleted': '已删除配置字典 {name}',
  'configmaps.federated': '联邦',

  'detail.back': '返回列表',
  'detail.overview': '基本信息',
  'detail.keys': '数据',
} as const;

export type LocaleKey = keyof typeof zh;

export const en: Record<LocaleKey, string> = {
  'app.name': 'AI Compute Platform',
  'app.skipToContent': 'Skip to main content',
  'nav.primary': 'Primary navigation',
  'nav.toggle': 'Toggle navigation',

  'common.loading': 'Loading',
  'common.retry': 'Retry',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.create': 'Create',
  'common.save': 'Save',
  'common.search': 'Search',
  'common.refresh': 'Refresh',
  'common.close': 'Close',
  'common.name': 'Name',
  'common.description': 'Description',
  'common.actions': 'Actions',
  'common.more': 'More actions',
  'common.selected': '{count} selected',
  'common.page': 'Page {page}',
  'common.empty': 'No data',

  'error.title': 'Failed to load',
  'error.unauthorized': 'You do not have permission for this action',
  'error.notFound': 'Resource not found',
  'error.network': 'Network error, please retry',
  'error.unknown': 'Unknown error',

  'configmaps.title': 'ConfigMaps',
  'configmaps.description': 'Manage ConfigMaps in this project.',
  'configmaps.searchPlaceholder': 'Search by name',
  'configmaps.column.keys': 'Keys',
  'configmaps.column.createdAt': 'Created',
  'configmaps.empty.title': 'No ConfigMaps',
  'configmaps.empty.description': 'Create one to mount into a workload.',
  'configmaps.action.create': 'Create',
  'configmaps.action.editYaml': 'Edit YAML',
  'configmaps.action.delete': 'Delete',
  'configmaps.action.bulkDelete': 'Delete selected',
  'configmaps.confirm.delete': 'Delete this ConfigMap?',
  'configmaps.confirm.bulkDelete': 'Delete the selected ConfigMaps?',
  'configmaps.deleted': 'Deleted ConfigMap {name}',
  'configmaps.federated': 'Federated',

  'detail.back': 'Back to list',
  'detail.overview': 'Overview',
  'detail.keys': 'Data',
};

export type Dictionary = Record<LocaleKey, string>;
export type Locale = 'zh' | 'en';

export const dictionaries: Record<Locale, Dictionary> = { zh, en };

/** Values interpolated into `{placeholder}` slots. */
export type TranslateParams = Record<string, string | number>;

export type Translate = (key: LocaleKey, params?: TranslateParams) => string;

/**
 * Build a translator for one language.
 *
 * A missing key returns the key itself rather than throwing: a raw key in the UI
 * is a visible bug that gets fixed, while a throw takes the whole page down.
 * Missing *parameters* are left as the literal `{name}` for the same reason.
 */
export function createTranslator(locale: Locale): Translate {
  const dictionary = dictionaries[locale];
  return (key, params) => {
    const template = dictionary[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}

/** Keys that appear in the UI, for tests that assert coverage. */
export const allKeys: readonly LocaleKey[] = Object.keys(zh) as LocaleKey[];
