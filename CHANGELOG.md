### Upcoming

* Allow ignoring the `.eslintignore` file

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
