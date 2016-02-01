# Contributing

## Basic Steps

If you would like to contribute enhancements or fixes, please do the following:

1.  Fork the plugin repository
2.  Run `npm install` to setup all dependencies
3.  Hack on a separate topic branch created from the latest `master`
4.  Commit and push the topic branch
5.  Make a pull request
6.  Welcome to the club!

## Guidelines

Please note that modifications should follow these coding guidelines:

*   Indent is 2 spaces
*   Code should pass the `eslint` linter
*   Vertical whitespace helps readability, don’t be afraid to use it

## Building

The simplest procedure is to run `npm run watch` which executes
`ucompiler watch`. UCompiler will automatically start watching the `src`
directory and will recompile any changed files. If you prefer to compile
them manually, use `npm run compile` which will run `ucompiler go` for you.

Thank you for helping out!
