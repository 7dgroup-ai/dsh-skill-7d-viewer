/**
 * tsdown build for dsh-skill-7d-viewer: the host-half lib (lib/index.js,
 * ESM node) plus two browser client bundles (lib/client.js and
 * lib/client-registry.js, CJS closure factory) — one per install channel:
 *
 * - `lib/client.js` serves the official profile channel, registering with the
 *   package-name id `@7dgroup/dsh-skill-7d-viewer` (the client-modules compose
 *   keys on the package name; keep it in sync with package.json `name`),
 * - `lib/client-registry.js` serves the plugin-registry channel
 *   (dsh.plugin.json), registering with the manifest id
 *   `7dgroup/dsh-skill-7d-viewer`.
 *
 * Both bundles replicate the official DSH client-bundle preset
 * (packages/client/tsdown.client.ts) and compile from the same
 * src/client/index.ts source — only the registered id and the output file name
 * differ. Externals resolve through the loader module table at runtime; every
 * other dependency inlines; a purity gate rejects any other @deepseek-ai value
 * import (cross-plugin collaboration goes through cordis services, never value
 * imports). CSS Modules compile to hashed class maps and inject
 * <style data-plugin> tags at factory execution.
 */
import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve as resolvePath, sep } from 'node:path'
import { builtinModules } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/** Node builtins must never survive into the browser module-loader factory. */
const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map(id => `node:${id}`),
])

/** Module specifiers the web shell shares into the frozen module table. */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
]

const REPOSITORY_ROOT = fileURLToPath(new URL('.', import.meta.url))
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Rebase a physical lib-relative source onto the repository-shaped URL tree. */
function browserSourcePath(source: string, sourcemapPath: string): string {
  if (!source.startsWith('.')) return source
  const physicalSource = resolvePath(dirname(sourcemapPath), source)
  return `../../../${relative(REPOSITORY_ROOT, physicalSource).split(sep).join('/')}`
}

/** The style-injection prologue shared by every stylesheet. */
function injectTag(pluginId: string, fileId: string, cssText: string): string {
  const tagId = `${pluginId}/${basename(fileId)}`
  return [
    `const css = ${JSON.stringify(cssText)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
    `  const tag = document.createElement('style');`,
    `  tag.dataset.plugin = ${JSON.stringify(pluginId)};`,
    `  tag.dataset.pluginCss = tagId;`,
    `  tag.textContent = css;`,
    `  document.head.appendChild(tag);`,
    `}`,
  ].join('\n')
}

/** A rolldown plugin as tsdown's config accepts it. */
type BuildPlugin = NonNullable<UserConfig['plugins']>

/** The shared client-bundle purity gate. */
function purityGatePlugin(): BuildPlugin {
  return {
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (NODE_BUILTINS.has(source)) {
        throw new Error(
          `client bundle purity: Node builtin "${source}" cannot run in the browser module table`,
        )
      }
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source)) return null // platform module: external wins
      throw new Error(
        `client bundle purity: "${source}" is not a platform module (CLIENT_EXTERNALS) — `
        + 'cross-plugin value imports are forbidden; collaborate through cordis services '
        + '(type-only imports are erased and never reach this gate)',
      )
    },
  }
}

/** The CSS-inline virtual-module plugin (one <style data-plugin> per file). */
function makeCssPlugin(pluginId: string): BuildPlugin {
  return {
    name: 'dsh-css-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.css')) return null
      const abs = source.startsWith('.')
        ? (importer === undefined ? source : resolvePath(dirname(importer), source))
        : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      if (fileId.endsWith('.module.css')) {
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        for (const [local, exported] of Object.entries(cssExports ?? {})) classMap[local] = exported.name
        return [
          injectTag(pluginId, fileId, code.toString()),
          `export default ${JSON.stringify(classMap)};`,
        ].join('\n')
      }
      return [
        injectTag(pluginId, fileId, source.toString('utf8')),
        'export default "";',
      ].join('\n')
    },
  }
}

/**
 * One client bundle build for a plugin id. The same src/client/index.ts is
 * compiled twice with only the registered id and the output file name differing.
 * @param pluginId - the `__ModuleLoader__.load({ id })` value and the
 *   data-plugin style-tag prefix of this bundle.
 * @param entryFile - the output file name under lib/.
 */
function clientBundle(pluginId: string, entryFile: string): UserConfig {
  return {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      // Module-table entries stay imports (the loader answers the require);
      // everything else is inlined so the bundle never requires a missing row.
      neverBundle: (id: string) => CLIENT_EXTERNALS.includes(id),
      alwaysBundle: (id: string) => !CLIENT_EXTERNALS.includes(id),
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
      'import.meta.resolve': 'undefined',
    },
    inputOptions: {
      resolve: {
        conditionNames: ['browser', 'import', 'require', 'default'],
      },
    },
    plugins: [purityGatePlugin(), makeCssPlugin(pluginId)],
    outputOptions: {
      entryFileNames: entryFile,
      sourcemapPathTransform: browserSourcePath,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pluginId)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      codeSplitting: false,
    },
  }
}

export default [
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    // clean stays off: the build script removes lib/ wholesale before tsc, so a
    // tsdown clean here would wipe the lib/types declarations tsc just emitted.
    clean: false,
  },
  // Official profile channel: bundle id = package name (package.json `name`).
  clientBundle('@7dgroup/dsh-skill-7d-viewer', 'client.js'),
  // Plugin-registry channel: bundle id = manifest id (dsh.plugin.json `id`).
  clientBundle('7dgroup/dsh-skill-7d-viewer', 'client-registry.js'),
] satisfies UserConfig[]
