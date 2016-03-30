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

## Discussion
If you have any questions during development you can join the #linter-plugin-dev channel on [Atom's Slack instance](http://atom-slack.herokuapp.com/).

## Building

The simplest procedure is to run `npm run watch` which executes
`ucompiler watch`. UCompiler will automatically start watching the `src`
directory and will recompile any changed files. If you prefer to compile
them manually, use `npm run compile` which will run `ucompiler go` for you.

## Releasing

Project members with push access to the repository also have the permissions
needed to release a new version.  If there have been changes to the project and
the team decides it is time for a new release, the process is to:

1. Update `CHANGELOG.md` with the planned version number and a short bulleted
list of major changes.  Include pull request numbers if applicable.
1. Run `npm run compile` to build the files in `lib/`
1. Commit the changelog and any `lib/` changes to master.
1. Publish a new version with `apm publish {major|minor|patch}`, using semver to
decide what type of version should be released.
1. `apm` will then automatically:
  * Update `package.json` with the new version number
  * Commit the changed `package.json` to master
  * Create a git tag for the new version and push it to GitHub
  * Publish the package to the Atom package manager

Thank you for helping out!
