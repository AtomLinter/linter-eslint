# linter-eslint

[![Build Status](https://travis-ci.org/AtomLinter/linter-eslint.svg)](https://travis-ci.org/AtomLinter/linter-eslint)
[![Dependency Status](https://david-dm.org/AtomLinter/linter-eslint.svg)](https://david-dm.org/AtomLinter/linter-eslint)

This linter plugin for [Linter](https://github.com/AtomLinter/Linter) provides
an interface to [eslint](http://eslint.org). It will be used with files that
have the "JavaScript" syntax.

## Installation

```ShellSession
apm install linter-eslint
```

`linter-eslint` will look for a version of `eslint` local to your project and
use it if it's available. If none is found it will fall back to the version it
ships with.

Lets say you depend on a specific version of `eslint`, maybe it has unreleased
features, maybe it's just newer than what `linter-eslint` ships with. If
`your-project/node_modules/eslint` exists `linter-eslint` will be used.
This package requires an `eslint` of at least v1.0.0.

Note that if you do not have the `linter` package installed it will be
installed
for you. If you are using an alternative `linter-*` consumer feel free
to disable the `linter` package.

## Use with plugins

You have two options:

*   Install locally to your project `eslint` and the plugin

    *   `$ npm i --save-dev eslint [eslint-plugins]`

*   Install globally `eslint` and plugins

    *   `$ npm i -g eslint [eslint-plugins]`
    *   Activate `Use Global Eslint` package option
    *   (Optional) Set `Global Node Path` with `$ npm config get prefix`

## Using ESLint

Note that recent versions of ESLint do not use any rules by-default. This
means you have to specify a configuration file for your project!

To do this in a straightforward way run this:

```ShellSession
eslint --init
```

Alternatively you can create the `.eslintrc` file by yourself. It is a good
idea to have a look at the [Get Started With ESLint](http://devnull.guru/get-started-with-eslint/)
blog post by [IanVS](https://github.com/IanVS) and [the ESLint documentation](http://eslint.org/docs/user-guide/configuring),
including the [list of rules](http://eslint.org/docs/rules/).

## A Note About Settings

If Use Global is on, Atom will use the global ESLint. The path to it is figured out by running `npm get prefix`. If this fails for any reason, you can set the global path manually in Global Node Installation Path.

If Use Global is off, Atom will try to find a local installation in the project folder, look if there's ESLint in `${PROJECT_ROOT}/node_modules` and use it if found.

The path to the local node_modules folder can be a path relative to the project or an absolute path and should end in /node_modules/. This path is used if the other methods of discovery have failed.

If there is no local installation Atom will use the built-in ESLint in the linter-eslint package itself.

## Contributing

See the [contributing guidelines](./CONTRIBUTING.md) to get started
