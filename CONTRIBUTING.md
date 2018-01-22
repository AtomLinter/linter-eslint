# Contributing

## Basic Steps

If you would like to contribute enhancements or fixes, please do the following:

1. Fork the package repository and clone your fork to a local folder.

1. Run `npm install` in the project to setup all dependencies.

1. Run `apm link --dev` to link your working folder as a development-mode-only package. ([Testing](#testing))

1. Run `git checkout -b my-awesome-branch` to create and checkout a separate branch for your work. ([Tips](#tips))

1. Hack away at the code, and don't forget to have fun. :woman_technologist:

1. Check for lint errors with `npm run lint` or use `linter-eslint` within Atom. ([Guidelines](#code-guidelines))

1. Run `atom --dev path/to/cool-project` to test-drive your improvements. ([Testing](#testing))

1. Run the specs and verify they are all green. ([Testing](#testing))

1. Commit the changes and push the topic branch to your fork on GitHub.

1. Make a pull request to the main repo [here](https://github.com/AtomLinter/linter-eslint/compare).

1. Welcome to the club! :woman_cartwheeling:

# Tips

* The steps above had you checkout a separate branch. This is not strictly necessary. But it is strongly encouraged. The `master` branch might update before your commit is merged. In this case, you will need to rebase those changes into your own commit. Having a separate branch for your work greatly reduces the number of things that can go wrong in that process.

## Code Guidelines

Please note that modifications should follow these coding guidelines:

* Code should pass linting by `eslint`. In addition to checking for common bugs, the linter is used to enforce style requirements.

* Vertical whitespace helps readability, don’t be afraid to use it!

## Testing

* Running `apm link --dev` will link your working folder to Atom as a development-mode-only package. Atom will load this development version of the package instead of any regularly installed package, allowing you to test your code in a live environment. Use `atom --dev some/project/folder` to start in developer mode.

* There are several ways to start the specs. Any of these will run the full test suite. Make sure the tests pass before submitting a pull request.
    * Run `atom --test spec` in the command line.
    * Type `specs` in the Command Pallete and press <kbd>Enter</kbd>.
    * Click through the menus `View` -> `Developer` -> `Run` -> `Package Specs`
    * Press the hotkey <kbd>Ctrl</kbd>-<kbd>Y</kbd> or <kbd>⌘</kbd>-<kbd>Alt</kbd>-<kbd>Ctrl</kbd>-<kbd>P</kbd>


## Discussion
If you have any questions during development you can join the `#linter-plugin-dev`
channel on [Atom's Slack instance](http://atom-slack.herokuapp.com/).

## Maintainers

* If given Maintainer status, you should create your branches directly off of the `atom-linter` repo instead of using a fork. This allows other maintainers to easily add additional commits to your branch for an open pull request.

* Project members with push access to the repository also have the permissions
needed to release a new version.  If there have been changes to the project and
the team decides it is time for a new release, the process is to:

    1.  Update `CHANGELOG.md` with the planned `semver` version number and a short
    bulleted list of major changes.  Include pull request numbers if applicable.

    1.  Update `package.json` with the new version number.

    1.  Commit the changed `package.json` and `CHANGELOG.md` to master

    1.  Create a git tag for the new version and push it to GitHub
      * To create the (signed) tag: `git tag -s -m "vx.y.z" vx.y.z`
      * To push to GitHub: `git push --follow-tags`

    1.  Publish the package to the Atom package manager
      * `apm publish --tag vx.y.z`

Thank you for helping out! :two_hearts:
