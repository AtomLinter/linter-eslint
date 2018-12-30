# Changelog

## v8.5.0
*  Organize configuration options ([#1042][])
*  Add source.flow to default scopes ([#1194][])
*  Upgrade dependencies (various)
*  Migrate to CircleCi 2.0
*  Add Renovate for dependency management
*  Add commitlint

[#1042]: https://github.com/AtomLinter/linter-eslint/pull/1042
[#1194]: https://github.com/AtomLinter/linter-eslint/pull/1194

## v8.4.1

*   Support [`CLIEngine#getRules`][] and [`rule.meta.docs.url`][] ([#1067][])
*   Automatically restart the worker process if it dies ([#1073][])
*   Merge all rules to ignore while typing ([#1084][])

[`rule.meta.docs.url`]: https://github.com/eslint/eslint/pull/9788
[`CLIEngine#getRules`]: https://github.com/eslint/eslint/pull/9782
[#1067]: https://github.com/AtomLinter/linter-eslint/pull/1067
[#1073]: https://github.com/AtomLinter/linter-eslint/pull/1073
[#1084]: https://github.com/AtomLinter/linter-eslint/pull/1084

## v8.4.0

*   Normalize all config paths ([#1014][])
*   Check for remote files ([#1017][])
*   Allow multiple rule directories ([#1016][])

[#1014]: https://github.com/AtomLinter/linter-eslint/pull/1014
[#1016]: https://github.com/AtomLinter/linter-eslint/pull/1016
[#1017]: https://github.com/AtomLinter/linter-eslint/pull/1017

## v8.3.2

*   Verify that a rule has a meta property before accessing ([#1026][])

[#1026]: https://github.com/AtomLinter/linter-eslint/pull/1026

## v8.3.1

*   Fix deprecation warning in Atom v1.21.0 ([#1019][])
*   Don't attempt to process fixable rules on ESLint v3 ([#1024][])

[#1019]: https://github.com/AtomLinter/linter-eslint/pull/1019
[#1024]: https://github.com/AtomLinter/linter-eslint/pull/1024

## v8.3.0

*   Stop breaking `BABEL_ENV` within Atom ([#961][])
*   Handle empty `projectPath` in diagnostic command ([#962][])
*   Set `cwd` to project directory if no `.eslintignore` is found ([#965][])
*   Update to ESLint v4.6.0 internally ([#938][], [#997][])
*   Add a right click command to trigger a fix job ([#963][])
*   Ignore invalid `TextEditor`s for fix jobs ([#978][])
*   Handle ESLint errors as a lint message ([#1015][])
*   Add option to silence fixable rules while typing ([#1018][])

[#938]: https://github.com/AtomLinter/linter-eslint/pull/938
[#961]: https://github.com/AtomLinter/linter-eslint/pull/961
[#962]: https://github.com/AtomLinter/linter-eslint/pull/962
[#963]: https://github.com/AtomLinter/linter-eslint/pull/963
[#965]: https://github.com/AtomLinter/linter-eslint/pull/965
[#978]: https://github.com/AtomLinter/linter-eslint/pull/978
[#997]: https://github.com/AtomLinter/linter-eslint/pull/997
[#1015]: https://github.com/AtomLinter/linter-eslint/pull/1015
[#1018]: https://github.com/AtomLinter/linter-eslint/pull/1018

## v8.2.1

*   Prevent users `.babelrc` from breaking building the package ([#922](https://github.com/AtomLinter/linter-eslint/pull/922))

## v8.2.0

*   Linter API v2 ([#855](https://github.com/AtomLinter/linter-eslint/pull/855))
*   Support global Yarn installs and better errors ([#907](https://github.com/AtomLinter/linter-eslint/pull/907))
*   Preserve `.eslintcache` on fixes ([#898](https://github.com/AtomLinter/linter-eslint/pull/898))
*   Handle parse errors better ([#911](https://github.com/AtomLinter/linter-eslint/pull/911))
*   Move to the Task API ([#889](https://github.com/AtomLinter/linter-eslint/pull/889))
*   Use Atom's per-package transpilation ([#890](https://github.com/AtomLinter/linter-eslint/pull/890))
*   Wait on specific Notifications in the specs ([#902](https://github.com/AtomLinter/linter-eslint/pull/902))
*   Fix builds of Atom beta ([#913](https://github.com/AtomLinter/linter-eslint/pull/913))
*   Fix embedded HTML scope with custom scopes ([#914](https://github.com/AtomLinter/linter-eslint/pull/914))
*   Utilize `warnIgnored` instead of filtering messages ([#915](https://github.com/AtomLinter/linter-eslint/pull/915))
*   Remove attempt to reset cursor position ([#876](https://github.com/AtomLinter/linter-eslint/pull/876))
*   Add specs for `showRuleIdInMessage` ([#916](https://github.com/AtomLinter/linter-eslint/pull/916))

## v8.1.7

*   Let ESLint handle configuration where possible ([#896](https://github.com/AtomLinter/linter-eslint/pull/896))

## v8.1.6

*   Reduce package activation time ([#875](https://github.com/AtomLinter/linter-eslint/pull/875))
*   Async-ify the specs ([#878](https://github.com/AtomLinter/linter-eslint/pull/878))
*   Cancel pending idle callbacks on deactivate ([#880](https://github.com/AtomLinter/linter-eslint/pull/880))

## v8.1.5

*   Move to the `CLIEngine` API ([#873](https://github.com/AtomLinter/linter-eslint/pull/873))
*   Attempt to restore cursor position after fixing ([#853](https://github.com/AtomLinter/linter-eslint/pull/853))

## v8.1.4

*   Improve package.json eslintConfig support ([#848](https://github.com/AtomLinter/linter-eslint/pull/848))

## v8.1.3

*   Log the file scope in debug command ([#835](https://github.com/AtomLinter/linter-eslint/pull/835))
*   Don't specify rulesDir if not found ([#843](https://github.com/AtomLinter/linter-eslint/pull/843))
*   Update specs for ESLint v3.17.0 ([#844](https://github.com/AtomLinter/linter-eslint/pull/844))

## v8.1.2

*   Update `atom-linter` bringing in a fix for #765 ([#817](https://github.com/AtomLinter/linter-eslint/pull/817))

## v8.1.1

*   Exclude `.babelrc` from releases ([#809](https://github.com/AtomLinter/linter-eslint/pull/809))
*   Use cursor scope instead of file when checking fix-on-save ([#811](https://github.com/AtomLinter/linter-eslint/pull/811))
*   Handle undefined package path ([#812](https://github.com/AtomLinter/linter-eslint/pull/812))
*   Temporarily disable an intermittent spec ([#813](https://github.com/AtomLinter/linter-eslint/pull/813))
*   Remove custom styling on rules ([#814](https://github.com/AtomLinter/linter-eslint/pull/814))

## v8.1.0

*   Handle invalid points gracefully ([#761](https://github.com/AtomLinter/linter-eslint/pull/761))
*   Warn on partial fixes ([#777](https://github.com/AtomLinter/linter-eslint/pull/777))
*   Ignore `~/.eslintrc` when determining `disableWhenNoEslintConfig` status ([#778](https://github.com/AtomLinter/linter-eslint/pull/778))
*   Allow rules to be excluded from fix runs ([#795](https://github.com/AtomLinter/linter-eslint/pull/795))


## v8.0.0

*   Update ESLint to v3.5.0 ([#692](https://github.com/AtomLinter/linter-eslint/pull/692))
*   Add setting for rules to silence while typing ([#666](https://github.com/AtomLinter/linter-eslint/pull/666))
*   Update ESLint to v3.6.0 ([#713](https://github.com/AtomLinter/linter-eslint/pull/713))
*   Add a debug information command ([#730](https://github.com/AtomLinter/linter-eslint/pull/730))
*   Add support for `endLine` and `endColumn` in ESLint messages ([#709](https://github.com/AtomLinter/linter-eslint/pull/709))

## v7.3.2

*   Fix a race condition with modified editor text ([#703](https://github.com/AtomLinter/linter-eslint/pull/703))

## v7.3.1

*   Throw original error for invalid ranges ([#694](https://github.com/AtomLinter/linter-eslint/pull/694))

## v7.3.0

*   Fix sending `null` to `path.dirname()` for future Electron compatibility ([#673](https://github.com/AtomLinter/linter-eslint/pull/673))
*   Use `eslint-rule-documentation` to get help URL's for rules ([#657](https://github.com/AtomLinter/linter-eslint/pull/657))
*   Correctly ignore the messages from ESLint about ignored files ([#670](https://github.com/AtomLinter/linter-eslint/pull/670))
*   Make the scopes linter-eslint runs on configurable ([#629](https://github.com/AtomLinter/linter-eslint/pull/629))
*   Move configuration to the `package.json` ([#619](https://github.com/AtomLinter/linter-eslint/pull/619))

## v7.2.4

*   Bump minimum Atom version to v1.8.0

## v7.2.3

*   Clarified `disableEslintIgnore` description ([#569](https://github.com/AtomLinter/linter-eslint/pull/569))
*   Update `eslint-plugin-ava` link ([#589](https://github.com/AtomLinter/linter-eslint/pull/589))
*   Update ignore message for `eslint@2.11.1` ([#593](https://github.com/AtomLinter/linter-eslint/pull/593))

## v7.2.2

*   Add links for several plugin's rules ([#562](https://github.com/AtomLinter/linter-eslint/pull/562))

## v7.2.1

*   Only run Fix on Save on supported file types ([#545](https://github.com/AtomLinter/linter-eslint/pull/545))

## v7.2.0

*   Add Fix on Save option ([#508](https://github.com/AtomLinter/linter-eslint/pull/508))

## v7.1.3

*   Reliably use `.eslintignore` file if present (#481)

## v7.1.2

*   Skipped due to release difficulties

## v7.1.1

*   Fix link color in certain themes (#480)

## v7.1.0

*   Add a link to the rule definition page in HTML messages (#476)
*   Pin the bundled `eslint` to v2.2.0 (#478)

## v7.0.0

*   Fix finding local `eslint` instance again (#409)
*   Workaround $PATH bug on OSX (#411)
*   Support the upcoming linter fix API (#415)
*   Update bundled `eslint` to v2.2.0 (#451) **Potentially Breaking**

## v6.0.0

*   Rewrite in ES6
*   Refactor the codebase and fix several bugs

## v5.2.7

*   Remove timeout from worker spawn

## v5.2.6

*   Fix file exception on Windows resolution (#354)
*   Verify `configFile` is a string before using it (#358)

## v5.2.5

*   Fix file import resolution (#340)
*   Fix a bug detecting `.eslintrc.js` configurations (#343)
*   Fix file now uses the same worker as for linting (#307)

## v5.2.4

*   Update dependencies to bring in some bug fixes

## v5.2.3

*   Fix a typo introduced by last release

## v5.2.2

*   Allow ignoring the `.eslintignore` file

*   Add `disableWhenNoEslintConfig` config (`true` by default) to only disable
    the linter if no ESLint config is found in a `package.json` or `.eslintrc`
    file. This replaces the `disableWhenNoEslintrcFileInPath` config.

*   Add support for ESlint configuration file formats `.eslintrc.js`,
    `.eslintrc.yaml`, `.eslintrc.yml`, and `.eslintrc.json`

## v5.2.1

*   Support local and absolute paths for eslintRulesDir

*   Handle messages with no line properly

*   Interpolate environment variables in the provided path for the eslint
    config file

## v5.2.0

*   Fix a bug where column would be incorrect sometimes
*   Respawn the worker if it crashes
*   Re-add `eslintRulesDir` config
*   Add support for `.eslintignore`
*   Add `eslintRcPath` config
*   Add `linter-eslint:fix-file` command

## v5.1.0

*   Improved error verbosity
*   Show a nice error notification if `npm get prefix` fails
*   Re-add `globalNodePath` config

## v5.0.2

*   Support local ESLint installation
*   Support global ESLint on Windows

## v5.0.1

*   Shows a nice notification if the worker process crashed for unknown reasons

## v5.0.0

*   Rewrote to make use of linting worker
