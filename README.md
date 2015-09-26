# linter-eslint

This linter plugin for [Linter](https://github.com/AtomLinter/Linter) provides
an interface to [eslint](http://eslint.org). It will be used with files that
have the “JavaScript” syntax.

## Installation
```ShellSession
apm install linter-eslint
```

`linter-eslint` will look for a version of `eslint` local to your project and
use it if it's available. If none is found it will fall back to the version it
ships with.

Lets say you depend on a specific version of `eslint`, maybe it has unreleased
features, maybe it's just newer than what linter-eslint ships with. If
`your-project/node_modules/eslint` exists `linter-eslint` will be used.

Note that if you do not have the `linter` package installed it will be installed
for you. If you are using an alternative `linter-*` consumer feel free to disable
the `linter` package.

## Use with plugins

You have two options:

* Install locally to your project `eslint` and the plugin
  * `$ npm i --save-dev eslint [eslint-plugins]`

* Install globaly `eslint` and plugins
  * `$ npm i -g eslint [eslint-plugins]`
  * Activate `Use Global Eslint` package option
  * (Optional) Set `Global Node Path` with `$ npm config get prefix`

## Settings

You can configure linter-eslint by editing ~/.atom/config.cson (choose Open Your Config in Atom menu) or in Preferences:

```cson
'linter-eslint':
  'eslintRulesDir': 'mydir'
  'disableWhenNoEslintrcFileInPath': true
  'useGlobalEslint': true
  'showRuleIdInMessage': true
  'globalNodePath': '/Users/foo/.nvm/versions/io.js/v2.3.1'
```

* `eslintRulesDir` is relative to the working directory (project root)
* `disableWhenNoEslintrcFileInPath` allows disabling linter-eslint when there is no `.eslintrc` found in project
* `useGlobalEslint` allows using globally installed eslint and plugins for it
* `showRuleIdInMessage`
  * `true` will append the `eslint` ruleId to warning/error messages


## Contributing

If you would like to contribute enhancements or fixes, please do the following:

0. Fork the plugin repository
0. Hack on a separate topic branch created from the latest `master`
0. Commit and push the topic branch
0. Make a pull request
0. Welcome to the club!

Please note that modifications should follow these coding guidelines:

* Indent is 2 spaces
* Code should pass `coffeelint` linter with the provided `coffeelint.json`
* Vertical whitespace helps readability, don’t be afraid to use it

Thank you for helping out!
