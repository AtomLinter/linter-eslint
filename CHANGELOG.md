### v5.5.3

* Fix a typo introduced by last release

### v5.2.2

* Allow ignoring the `.eslintignore` file
* Add `disableWhenNoEslintConfig` config (`true` by default) to only disable the linter if no ESLint config is found in a `package.json`
or `.eslintrc` file.  This replaces the `disableWhenNoEslintrcFileInPath` config.
* Add support for ESlint configuration file formats `.eslintrc.js`, `.eslintrc.yaml`, `.eslintrc.yml`, and `.eslintrc.json`

### v5.2.1

* Support local and absolute paths for eslintRulesDir
* Handle messages with no line properly
* Interpolate environment variables in the provided path for the eslint config file

### v5.2.0

* Fix a bug where column would be incorrect sometimes
* Respawn the worker if it crashes
* Re-add `eslintRulesDir` config
* Add support for `.eslintignore`
* Add `eslintRcPath` config
* Add `linter-eslint:fix-file` command

### v5.1.0

* Improved error verbosity
* Show a nice error notification if `npm get prefix` fails
* Re-add `globalNodePath` config

### v5.0.2

* Support local ESLint installation
* Support global ESLint on Windows

### v5.0.1

* Shows a nice notification if the worker process crashed for unknown reasons

### v5.0.0

* Rewrote to make use of linting worker
