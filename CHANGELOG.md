# Changelog

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
