# linter-eslint

This linter plugin for [Linter](https://github.com/AtomLinter/Linter) provides an interface to [eslint](http://eslint.org). It will be used with files that have the “JavaScript” syntax.

## Installation
Linter package must be installed in order to use this plugin. If Linter is not installed, please follow the instructions [here](https://github.com/AtomLinter/Linter).

### Package installation

* `$ apm install linter-eslint`

`linter-eslint` will look for a version of `eslint` local to your project and use it if it's available. It can fallback to global system `eslint` or specified one into preferences. If none is found it will fall back to the version it ships with.

Lets say you depend on a specific version of `eslint`, maybe it has unreleased features, maybe it's just newer than what linter-eslint ships with. If `your-project/node_modules/eslint` exists `linter-eslint` will be used.

## Use with plugins

You have two options:

* Install localy to your project `eslint` and the plugin
  * `$ npm i --save-dev eslint [eslint-plugins]`


* Install globaly `eslint` and plugins
  * `$ npm i -g eslint [eslint-plugins]`
  * (Optional) Set `Eslint Path` in preferences with `$ which eslint`

## Settings

You can configure linter-eslint by editing ~/.atom/config.cson (choose Open Your Config in Atom menu) or in Preferences:

```coffee
'linter-eslint':
  'eslintRulesDir': '~/extra-rules-dir'
  'disableWhenNoEslintrcFileInPath': true
  'showRuleIdInMessage': true
  'eslintPath': '~/eslint'
```

* `eslintRulesDir` (use a full path)
* `disableWhenNoEslintrcFileInPath` allows disabling linter-eslint when there is no `.eslintrc` found in project
* `showRuleIdInMessage`
  * `true` will append the `eslint` ruleId to warning/error messages


## Contributing

If you would like to contribute enhancements or fixes, please do the following:

* Fork the plugin repository
* Hack on a separate topic branch created from the latest `master`
* Commit and push the topic branch
* Make a pull request
* Welcome to the club

Please note that modifications should follow these coding guidelines:

* Indent is 2 spaces
* Run `$ npm run lint` to check the code style
* Vertical whitespace helps readability, don’t be afraid to use it

Thank you for helping out!
