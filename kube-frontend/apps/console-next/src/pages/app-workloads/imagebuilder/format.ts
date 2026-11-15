import type { LocaleKey } from '@kube-ai-hub/locales';
import type { S2iBuilderTemplate } from '@kube-ai-hub/api-client';

/**
 * Formatting and derivation shared by every screen of the image builder page family.
 *
 * The old console kept these rules in one place too (`object.mapper.js` for the
 * data, and the components for the labels); splitting the status map between the
 * list, the detail and the run records is how the two ended up disagreeing. Every
 * screen here calls these functions instead.
 */

/** Badge tone per normalised builder/run status. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const BUILDER_STATUS_KEYS: Record<string, LocaleKey> = {
  building: 'devopsProject.s2ibuilder.status.building',
  successful: 'devopsProject.s2ibuilder.status.successful',
  failed: 'devopsProject.s2ibuilder.status.failed',
  '': 'devopsProject.s2ibuilder.status.notRunYet',
};

const RUN_STATUS_KEYS: Record<string, LocaleKey> = {
  building: 'devopsProject.s2ibuilder.status.building',
  successful: 'devopsProject.s2ibuilder.status.successful',
  failed: 'devopsProject.s2ibuilder.status.failed',
  '': 'devopsProject.s2ibuilder.status.unknown',
};

export function builderStatusKey(status: string): LocaleKey {
  return BUILDER_STATUS_KEYS[status] ?? 'devopsProject.s2ibuilder.status.unknown';
}

export function runStatusKey(status: string): LocaleKey {
  return RUN_STATUS_KEYS[status] ?? 'devopsProject.s2ibuilder.status.unknown';
}

/** Tone is derived from the state, never from a literal in the page. */
export function statusTone(status: string): StatusTone {
  if (status === 'successful') return 'success';
  if (status === 'building') return 'info';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

export function kindKey(kind: string): LocaleKey {
  return kind === 'b2i' ? 'devopsProject.s2ibuilder.kind.b2i' : 'devopsProject.s2ibuilder.kind.s2i';
}

/**
 * The `IMAGE_NAME_<STATUS>` sentence the old run list showed under 最后消息.
 *
 * Kept as one sentence per state instead of string concatenation so a translator
 * can reorder it; the old console built it from the same three keys.
 */
export function runMessageKey(status: string): LocaleKey {
  if (status === 'successful') return 'devopsProject.s2ibuilder.records.message.successful';
  if (status === 'failed') return 'devopsProject.s2ibuilder.records.message.failed';
  if (status === 'building') return 'devopsProject.s2ibuilder.records.message.building';
  return 'devopsProject.s2ibuilder.records.message.unknown';
}

/**
 * Byte size formatting, identical to the old `formatSize` utility.
 *
 * The value comes from the controller as a number of bytes for images and as a
 * string ("47B") for binaries; a string that is already formatted is returned
 * verbatim rather than being parsed into a wrong unit.
 */
export function formatSize(size: number | string | undefined): string {
  if (size === undefined || size === '') return '-';
  if (typeof size !== 'number') return size;
  if (!Number.isFinite(size)) return '-';
  const divisor = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB', 'BB'];
  let value = size;
  let index = 0;
  while (value >= divisor && index < units.length - 1) {
    value = parseFloat((value / divisor).toFixed(2));
    index += 1;
  }
  return index === 0 ? String(Math.trunc(value)) + ' ' + units[index] : String(value) + ' ' + units[index];
}

/** The old alias pattern: letters, digits, Chinese characters and inner hyphens. */
export const ALIAS_PATTERN = /^(?!-)([a-zA-Z0-9\u4e00-\u9fa5-]+)(?<!-)$/;

/** The old `PATTERN_IMAGE_NAME`: lowercase repo path with an optional lowercase tag. */
export const IMAGE_NAME_PATTERN =
  /^[a-z0-9]([-a-z0-9]*[a-z0-9])?((\.|\/)[a-z0-9]([-a-z0-9]*[a-z0-9])?)*(:([a-z0-9])*)?$/;

/** The old trigger-token rule: alphanumeric only. */
export const TRIGGER_TOKEN_PATTERN = /^[a-zA-Z0-9]+$/;

/** Languages the create dialog offers even when no template declares them (old constants). */
const S2I_BASE_LANGUAGES = ['java', 'nodejs', 'python'];
const B2I_BASE_LANGUAGES = ['jar', 'war', 'binary'];

/** The old console mapped these template frameworks to their artifact extension. */
const B2I_FRAMEWORK_ALIAS: Record<string, string> = { java: 'jar', tomcat: 'war' };

export interface BuildLanguage {
  /** Language/artifact identifier, e.g. `java` or `jar`. */
  value: string;
  /** Locale key for the label; the old console translated the uppercased identifier. */
  key: LocaleKey;
}

/**
 * The build modes and languages the installed templates support.
 *
 * A template declares both a build type label and a code framework; the old
 * console derived the list from those labels and fell back to a constant list so
 * an empty template collection still offered the three source languages.
 */
export function buildLanguages(templates: S2iBuilderTemplate[]): { s2i: BuildLanguage[]; b2i: BuildLanguage[] } {
  const s2i = new Set<string>(S2I_BASE_LANGUAGES);
  const b2i = new Set<string>(B2I_BASE_LANGUAGES);
  for (const template of templates) {
    if (template.s2i && template.codeFramework) s2i.add(template.codeFramework);
    if (template.b2i) {
      const framework = B2I_FRAMEWORK_ALIAS[template.codeFramework] ?? template.codeFramework;
      if (framework) b2i.add(framework);
    }
  }
  const toEntries = (values: string[]): BuildLanguage[] =>
    values.map((value) => ({ value, key: languageKey(value) }));
  return { s2i: toEntries([...s2i].sort()), b2i: toEntries([...b2i].sort()) };
}

/** The translated name of a framework; unknown frameworks are shown raw. */
function languageKey(value: string): LocaleKey {
  return ('devopsProject.s2ibuilder.language.' + value) as LocaleKey;
}

export interface BuilderImageOption {
  /** `spec.config.builderImage`. */
  value: string;
  label: string;
  /** Localised description of the template the image belongs to. */
  description: string;
  docUrl: string;
  /** Extra `spec.config` fields the template declares (runtimeImage, buildVolumes…). */
  extraConfig: Record<string, unknown>;
  environment: NonNullable<S2iBuilderTemplate['environment']>;
}

/**
 * The builder images offered for one language in one build mode.
 *
 * The old `TemplateSelect` reduced the template list the same way: source builds
 * match `spec.codeFramework`; binary builds match the `binary-type` label. Each
 * entry carries its template's environment and doc link, which the form needs
 * when the reader picks a different image.
 */
export function builderImageOptions(
  templates: S2iBuilderTemplate[],
  mode: 's2i' | 'b2i',
  language: string,
): BuilderImageOption[] {
  const options: BuilderImageOption[] = [];
  for (const template of templates) {
    const matches =
      mode === 's2i'
        ? template.s2i && template.codeFramework === language
        : template.b2i && (B2I_FRAMEWORK_ALIAS[template.codeFramework] ?? template.codeFramework) === language;
    if (!matches) continue;
    for (const container of template.containerInfo ?? []) {
      if (!container.builderImage) continue;
      options.push({
        value: container.builderImage,
        label: container.builderImage,
        description: template.description,
        docUrl: template.docUrl,
        // The old form copied every container field into the config except the ones it
        // keeps as form-only state (environment, docUrl, description).
        extraConfig: Object.fromEntries(
          Object.entries(container).filter(([key]) => !['environment', 'docUrl', 'description'].includes(key)),
        ),
        environment: template.environment ?? [],
      });
    }
  }
  return options;
}

/** The image the form starts on: the template's default base image, else the first option. */
export function defaultBuilderImage(options: BuilderImageOption[], templates: S2iBuilderTemplate[], language: string): string {
  const template = templates.find((entry) => entry.codeFramework === language);
  if (template?.defaultBaseImage && options.some((entry) => entry.value === template.defaultBaseImage)) {
    return template.defaultBaseImage;
  }
  return options[0]?.value ?? '';
}

/**
 * The builder object name the old console generated on create.
 *
 * `<imageName with /_: → ->-tag>-<3 random chars>`, capped at 60 characters for the
 * image part so the resulting name stays a valid DNS-1123 subdomain.
 */
export function generatedBuilderName(imageName: string, tag: string): string {
  const base = (imageName || 'image-builder').replace(/[_/:]/g, '-');
  const trimmed = base.slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 5);
  return trimmed + '-' + (tag || 'latest') + '-' + suffix;
}

/** The binary object name the old uploader generated from the file name. */
export function generatedBinaryName(fileName: string): string {
  const base = fileName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-');
  const suffix = Math.random().toString(36).slice(2, 6);
  return base + suffix;
}

/** Merge the selected template's image fields into `spec.config` (old `handleTemplateChange`). */
export function applyBuilderImage(config: Record<string, unknown>, option: BuilderImageOption): Record<string, unknown> {
  return {
    ...config,
    builderImage: option.value,
    ...option.extraConfig,
  };
}

/**
 * Prepend the registry host of the selected push secret to the image name.
 *
 * The old `updateCreateData` did this so an image name like `my-app` becomes
 * `registry.example.com/my-app`; without it the controller pushes to Docker Hub.
 */
export function withRegistryPrefix(imageName: string, repoUrl: string): string {
  if (!repoUrl) return imageName;
  const bare = repoUrl.replace(/^(https?:\/\/)?/, '').replace(/\/$/, '');
  if (!bare) return imageName;
  return imageName.startsWith(bare) ? imageName : bare + '/' + imageName;
}
