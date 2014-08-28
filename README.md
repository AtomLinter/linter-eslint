linter-eslint
=========================

This linter plugin for [Linter](https://github.com/AtomLinter/Linter) provides an interface to [eslint](http://eslint.org). It will be used with files that have the “JavaScript” syntax.

## Installation
Linter package must be installed in order to use this plugin. If Linter is not installed, please follow the instructions [here](https://github.com/AtomLinter/Linter).

### Plugin installation
```
$ apm install linter-eslint
```

## Settings
You can configure linter-eslint by editing ~/.atom/config.cson (choose Open Your Config in Atom menu):
```
'linter-eslint':
  'eslintExecutablePath': null #eslint path. run 'which eslint' to find the path
  'eslintRulesDir': null
  'defaultEslintConfig': null
```

**Note**: This plugin finds the nearest .eslintrc file and uses the `--config` command line argument to use that file. If no config file is found, it uses the `defaultEslintConfig` setting instead.

The `eslintRulesDir` is relative to the working directory (project root).

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
