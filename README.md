linter-eslint
=========================

This linter plugin for [Linter](https://github.com/AtomLinter/Linter) provides an interface to [eslint](http://eslint.org). It will be used with files that have the “JavaScript” syntax.

## Installation
Linter package must be installed in order to use this plugin. If Linter is not installed, please follow the instructions [here](https://github.com/AtomLinter/Linter).

### Plugin installation
```
$ apm install linter-eslint
```

linter-eslint will look for a version of eslint local to your project and use it if it's available. If none is found it will fall back to the version it ships with.

Lets say you depend on a specific version of eslint, maybe it has unreleased features, maybe it's just newer than what linter-eslint ships with. If `your-project/node_modules/eslint` exists linter-eslint will try to use that.

## Settings
You can configure linter-eslint by editing ~/.atom/config.cson (choose Open Your Config in Atom menu) or in Preferences:

```
'linter-eslint':
  'eslintRulesDir': 'mydir'
  'disableWhenNoEslintrcFileInPath': true  
```

The `eslintRulesDir` is relative to the working directory (project root).
`disableWhenNoEslintrcFileInPath` allows disabling linter-eslint when there is no `.eslintrc` file in the path.


## Contributing
If you would like to contribute enhancements or fixes, please do the following:

1. Fork the plugin repository.
1. Hack on a separate topic branch created from the latest `master`.
1. Commit and push the topic branch.
1. Make a pull request.
1. welcome to the club

Please note that modifications should follow these coding guidelines:

- Indent is 2 spaces.
- Code should pass coffeelint linter.
- Vertical whitespace helps readability, don’t be afraid to use it.

Thank you for helping out!

## Donation
[![Share the love!](https://chewbacco-stuff.s3.amazonaws.com/donate.png)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=KXUYS4ARNHCN8)
