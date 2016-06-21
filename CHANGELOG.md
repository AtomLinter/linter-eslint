# Changelog

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
