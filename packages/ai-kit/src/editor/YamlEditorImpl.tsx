import * as React from 'react';
import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { yaml } from '@codemirror/lang-yaml';
import { autocompletion, closeBrackets, completionKeymap, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { linter } from '@codemirror/lint';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { parse as parseYaml } from 'yaml';
import { depthOf, fieldsFor, lastSegment } from './k8s-fields';

/**
 * The CodeMirror side of the editor.
 *
 * Split from `YamlEditor.tsx` so the lazy boundary actually contains CodeMirror:
 * importing the wrapper must not pull ~300KB of editor into the list page's chunk.
 */

export interface YamlEditorImplProps {
  value: string;
  onChange: (next: string) => void;
  onParseError: (error: string | null) => void;
  readOnly: boolean;
  ariaLabel: string;
}

/** Parse just enough to tell the host whether the document can be submitted. */
function checkYaml(text: string): { message: string; line: number; column: number } | null {
  if (!text.trim()) return null;
  try {
    parseYaml(text);
    return null;
  } catch (cause) {
    const error = cause as Error & { linePos?: Array<{ line: number; col: number }> };
    const pos = error.linePos?.[0];
    return {
      message: error.message.split('\n')[0] ?? 'YAML 语法错误',
      // CodeMirror counts from 1; keep that convention when reporting to the lint gutter.
      line: pos?.line ?? 1,
      column: pos?.col ?? 1,
    };
  }
}

/** Fields offered at the cursor, filtered by the indentation the cursor sits at. */
const yamlCompletions = (context: CompletionContext): CompletionResult | null => {
  const word = context.matchBefore(/[\w.-]*/);
  if (!word || (word.from === context.pos && !context.explicit)) return null;

  // The cursor's own line indentation is the only reliable signal for which
  // nesting level the reader is typing at.
  const lineStart = context.state.doc.lineAt(context.pos).from;
  const beforeCursor = context.state.sliceDoc(lineStart, context.pos);
  const indent = /^(\s*)/.exec(beforeCursor)?.[1]?.length ?? 0;
  const text = context.state.doc.toString();

  const options = fieldsFor(text)
    .filter((field) => (indent === 0 ? depthOf(field.path) === 0 : depthOf(field.path) > 0))
    .map((field) => ({
      label: lastSegment(field.path),
      detail: field.detail,
      type: 'property' as const,
    }));

  const unique = new Map(options.map((option) => [option.label, option]));
  return { from: word.from, options: [...unique.values()], validFor: /^[\w.-]*$/ };
};

export default function YamlEditorImpl({
  value,
  onChange,
  onParseError,
  readOnly,
  ariaLabel,
}: YamlEditorImplProps): React.ReactElement {
  const host = React.useRef<HTMLDivElement>(null);
  const view = React.useRef<EditorView | null>(null);
  // Callbacks are held in refs: rebuilding the editor whenever a parent re-renders
  // would lose the cursor position on every keystroke.
  const onChangeRef = React.useRef(onChange);
  const onParseErrorRef = React.useRef(onParseError);
  onChangeRef.current = onChange;
  onParseErrorRef.current = onParseError;

  React.useEffect(() => {
    if (!host.current) return undefined;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        yaml(),
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
        autocompletion({ override: [yamlCompletions], activateOnTyping: true }),
        closeBrackets(),
        keymap.of([...completionKeymap, ...defaultKeymap, indentWithTab]),
        /*
         * No `lintGutter()`: the diagnostics still render as a wavy underline in
         * the text, which is where the reader looks anyway, and the extra gutter
         * column sat beside the line numbers as 17px of empty space between the
         * numbers and the code.
         */
        linter((editor) => {
          const problem = checkYaml(editor.state.doc.toString());
          onParseErrorRef.current(problem?.message ?? null);
          if (!problem) return [];
          const line = editor.state.doc.line(Math.min(problem.line, editor.state.doc.lines));
          const from = Math.min(line.from + Math.max(problem.column - 1, 0), line.to);
          return [{ from, to: line.to, severity: 'error', message: problem.message }];
        }, { delay: 300 }),
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        syntaxHighlighting(codeHighlight),
        theme,
      ],
    });

    view.current = new EditorView({ state, parent: host.current });
    return () => {
      view.current?.destroy();
      view.current = null;
    };
    // Mount once. `value` is synced below; rebuilding on every change would reset
    // the cursor and the undo history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync an external `value` (e.g. switching between form and YAML, or loading the
  // object for editing) without clobbering what the user typed.
  React.useEffect(() => {
    const current = view.current;
    if (!current) return;
    if (current.state.doc.toString() === value) return;
    current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="min-h-0 flex-1 overflow-auto text-xs" />;
}

/**
 * Syntax colours, bound to ai-kit's CSS variables.
 *
 * CodeMirror's default palette is a light-theme one: keys and literals come out
 * `rgb(0, 0, 204)` and strings `rgb(170, 17, 17)`. On the console's navy panel
 * (`--ai-bg-elevated`) the blue keys are barely distinguishable from the
 * background, which is what made the editor hard to read.
 *
 * The values are CSS variables rather than hex so the editor follows the
 * `data-theme` switch like the rest of the app — the light palette redefines the
 * same `--ai-code-*` names.
 */
const codeHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'rgb(var(--ai-code-property))' },
  { tag: [t.string, t.special(t.string)], color: 'rgb(var(--ai-code-string))' },
  { tag: [t.number, t.bool, t.null], color: 'rgb(var(--ai-code-literal))' },
  { tag: [t.keyword, t.tagName, t.atom], color: 'rgb(var(--ai-code-keyword))' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'rgb(var(--ai-code-comment))', fontStyle: 'italic' },
  { tag: [t.punctuation, t.separator, t.bracket], color: 'rgb(var(--ai-code-punctuation))' },
  { tag: [t.typeName, t.className], color: 'rgb(var(--ai-code-keyword))' },
  { tag: t.invalid, color: 'rgb(var(--ai-danger))' },
]);

/**
 * Editor theme, built from ai-kit's CSS variables.
 *
 * Using the tokens rather than a fixed palette means the editor follows the
 * app's light/dark switch instead of staying dark on a light page.
 */
const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12px',
    backgroundColor: 'rgb(var(--ai-bg-elevated))',
    color: 'rgb(var(--ai-fg))',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', padding: '8px 0' },
  '.cm-gutters': {
    backgroundColor: 'rgb(var(--ai-bg-elevated))',
    color: 'rgb(var(--ai-fg-faint))',
    border: 'none',
    borderRight: '1px solid rgb(var(--ai-line))',
    // No right padding of its own: the line-number cell already pads 5px/3px, and
    // the fold arrow needs only a couple of pixels beside it.
    paddingRight: '0',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 2px 0 5px', minWidth: '0' },
  '.cm-foldGutter': { width: '10px' },
  '.cm-foldGutter .cm-gutterElement': { padding: '0 1px' },
  '.cm-activeLine': { backgroundColor: 'rgb(var(--ai-surface-2))' },
  '.cm-activeLineGutter': { backgroundColor: 'rgb(var(--ai-surface-2))' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-tooltip': {
    backgroundColor: 'rgb(var(--ai-bg-overlay))',
    border: '1px solid rgb(var(--ai-line))',
    borderRadius: 'var(--ai-radius-md, 6px)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'rgb(var(--ai-accent-soft))',
    color: 'rgb(var(--ai-accent))',
  },
  '.cm-lintRange-error': { textDecoration: 'underline wavy rgb(var(--ai-danger))' },
});
