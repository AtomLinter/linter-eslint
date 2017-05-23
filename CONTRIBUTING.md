# Contributing

## Basic Steps

If you would like to contribute enhancements or fixes, please do the following:

1.  Fork the package repository.
2.  Run `npm install` to setup all dependencies.
3.  Hack on a separate topic branch created from the latest `master`.
4.  Check for lint errors with `npm run lint` or use `linter-eslint` within Atom.
5.  Run the package specs.
6.  Commit the changes and push the topic branch to your fork.
7.  Make a pull request to the main repo.
8.  Welcome to the club!

## Guidelines

Please note that modifications should follow these coding guidelines:

*   Indent is 2 spaces.
*   Code should pass the `eslint` linter.
*   Vertical whitespace helps readability, don’t be afraid to use it!

## Testing

You can run the specs for this package locally by either running `apm test` from
the project directory, or from within Atom by going to View -> Developer -> Run
Package Specs.

## Discussion
If you have any questions during development you can join the #linter-plugin-dev
channel on [Atom's Slack instance](http://atom-slack.herokuapp.com/).

## Releasing

Project members with push access to the repository also have the permissions
needed to release a new version.  If there have been changes to the project and
the team decides it is time for a new release, the process is to:

1.  Update `CHANGELOG.md` with the planned `semver` version number and a short
    bulleted list of major changes.  Include pull request numbers if applicable.
2.  Update `package.json` with the new version number.
3.  Commit the changed `package.json` and `CHANGELOG.md` to master
4.  Create a git tag for the new version and push it to GitHub
  * To create the (signed) tag: `git tag -s -m "vx.y.z" vx.y.z`
  * To push to GitHub: `git push --follow-tags`
5.  Publish the package to the Atom package manager
  * `apm publish --tag vx.y.z`

Thank you for helping out!
