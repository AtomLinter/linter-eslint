# Changelog

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
