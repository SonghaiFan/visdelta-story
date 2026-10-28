import { useStoryVariable } from './bindings';
import { compile, run } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import type { Program } from 'estree';
import type { MDXModule } from 'mdx/types';
import { loadD3, loadFactories, type Rows } from '@/components/interactive/runtime';
import type { StoryDocument } from './document';

const baseUrl = 'https://story.visdelta.invalid/story.mdx';

/** MDX's own ESM lowering retains aliases, exports, and namespace imports.
 * Only module resolution changes: Studio files and installed packages are local.
 * This is an import resolver, not a JavaScript security sandbox.
 */
function studioImports() {
  return (tree: Program) => {
    function visit(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(visit); return; }
      const node = value as Record<string, unknown>;
      if (node.type === 'ImportExpression') {
        const source = node.source;
        for (const key of Object.keys(node)) delete node[key];
        Object.assign(node, {
          type: 'CallExpression',
          // This top-level binding also works inside authored functions, whose
          // own arguments object is unrelated to MDX's runtime options.
          callee: { type: 'Identifier', name: '__vdStudioImport' },
          arguments: [source], optional: false,
        });
      }
      Object.values(node).forEach(visit);
    }
    visit(tree);
    tree.body.splice(1, 0, {
      type: 'VariableDeclaration', kind: 'const', declarations: [{
        type: 'VariableDeclarator', id: { type: 'Identifier', name: '__vdStudioImport' },
        init: { type: 'MemberExpression', computed: false, optional: false,
          object: { type: 'MemberExpression', computed: true, optional: false,
            object: { type: 'Identifier', name: 'arguments' }, property: { type: 'Literal', value: 0 } },
          property: { type: 'Identifier', name: 'importModule' } },
      }],
    });
  };
}

/** Pre-import compatibility for the first Studio prototype's implicit chart. */
function legacyChart() {
  return (tree: { children: { type: string; value?: string; data?: { estree?: Program } }[] }) => {
    let declaresChart = false;
    let referencesChart = false;
    const inspect = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(inspect); return; }
      const node = value as Record<string, unknown>;
      if (node.type === 'Identifier' && node.name === 'chart') referencesChart = true;
      Object.values(node).forEach(inspect);
    };
    inspect(tree);
    const bindings = (node: unknown): boolean => {
      if (!node || typeof node !== 'object') return false;
      const value = node as Record<string, unknown>;
      if (value.type === 'Identifier') return value.name === 'chart';
      if (value.type === 'ObjectPattern' || value.type === 'ArrayPattern') return Object.values(value).some(v => Array.isArray(v) && v.some(bindings));
      if (value.type === 'Property') return bindings(value.value);
      if (value.type === 'RestElement') return bindings(value.argument);
      if (value.type === 'AssignmentPattern') return bindings(value.left);
      return false;
    };
    for (const child of tree.children) {
      for (const original of child.data?.estree?.body ?? []) {
        const node = original.type === 'ExportNamedDeclaration' && original.declaration ? original.declaration : original;
        if (node.type === 'ImportDeclaration') declaresChart ||= node.specifiers.some(s => s.local.name === 'chart');
        if (node.type === 'VariableDeclaration') declaresChart ||= node.declarations.some(d => bindings(d.id));
        if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') declaresChart ||= node.id?.name === 'chart';
      }
    }
    if (referencesChart && !declaresChart) {
      tree.children.unshift({ type: 'mdxjsEsm', value: "import { chart } from './chart.js'", data: { estree: {
        type: 'Program', sourceType: 'module', body: [{ type: 'ImportDeclaration', attributes: [], source: { type: 'Literal', value: './chart.js' },
          specifiers: [{ type: 'ImportSpecifier', imported: { type: 'Identifier', name: 'chart' }, local: { type: 'Identifier', name: 'chart' } }] }],
      } } });
    }
  };
}

export async function compileStory(doc: StoryDocument, components: Record<string, unknown>): Promise<MDXModule> {
  let rows: Rows;
  try { rows = JSON.parse(doc.rows); } catch { throw new Error('data.json: enter a valid JSON array of records.'); }
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('data.json: expected an array of objects.');
  let chartModule: Promise<Record<string, unknown>> | undefined;
  const resolveModule = async (specifier: string): Promise<unknown> => {
    switch (specifier) {
      case new URL('./chart.js', baseUrl).href:
        chartModule ??= (async () => {
          const factories = await loadFactories(['bar', 'line', 'area', 'point', 'unit', 'pie']);
          try {
            const names = Object.keys(factories) as (keyof typeof factories)[];
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            const evaluate = new AsyncFunction(...names, 'd3', 'rows', `"use strict";\n${doc.code}\nreturn { chart: typeof chart === 'undefined' ? undefined : chart, model: typeof model === 'undefined' ? undefined : model };`);
            const result = await evaluate(...names.map(name => factories[name]), await loadD3(), structuredClone(rows));
            if (!result.chart && typeof result.model !== 'function') throw new Error('Assign a VisDelta chart to const chart, or a StoryData function to const model.');
            if (result.chart && (typeof result.chart.toSpec !== 'function' || typeof result.chart.rows !== 'function')) throw new Error('const chart must be a native VisDelta chart.');
            if (result.model !== undefined && typeof result.model !== 'function') throw new Error('const model must be a StoryData function.');
            return { ...result, default: result.chart };
          } catch (error) { throw new Error(`chart.js: ${error instanceof Error ? error.message : error}`); }
        })();
        return chartModule;
      case new URL('./data.json', baseUrl).href: return { default: structuredClone(rows), rows: structuredClone(rows) };
      case new URL('./story-components.js', baseUrl).href: return { ...components, useStoryVariable };
      case new URL('./weather.js', baseUrl).href: {
        const [archive, story, fullCase, narrative] = await Promise.all([import('./weather-archive'), import('./weather-story'), import('./weather-case-components'), import('./weather-narrative')]);
        return { ...archive, ...story, ...fullCase, ...narrative };
      }
      case 'react': return React;
      case 'd3': return import('d3');
      case 'visdelta': return import('visdelta');
      case 'visdelta/bar': return import('visdelta/bar');
      case 'visdelta/line': return import('visdelta/line');
      case 'visdelta/area': return import('visdelta/area');
      case 'visdelta/point': return import('visdelta/point');
      case 'visdelta/unit': return import('visdelta/unit');
      case 'visdelta/pie': return import('visdelta/pie');
      case 'visdelta/chart-style': return import('visdelta/chart-style');
      default: throw new Error(`Cannot import “${specifier.replace(new URL('.', baseUrl).href, './')}”. Studio supports ./chart.js, ./data.json, ./story-components.js, ./weather.js, react, d3 and the built-in VisDelta chart modules.`);
    }
  };
  const code = await compile({ path: 'story.mdx', value: doc.story }, {
    outputFormat: 'function-body', remarkPlugins: [remarkGfm, legacyChart], recmaPlugins: [studioImports],
  });
  return run(code, { ...jsxRuntime, baseUrl, importModule: resolveModule } as Parameters<typeof run>[1]);
}
