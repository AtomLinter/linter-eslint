"use strict";

var _atom = require("atom");

var _editor = require("./validate/editor");

var helpers = _interopRequireWildcard(require("./helpers"));

var _migrateConfigOptions = require("./migrate-config-options");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
// Internal variables
const idleCallbacks = new Set();

const makeIdleCallback = work => {
  let callbackId;

  const callBack = () => {
    idleCallbacks.delete(callbackId);
    work();
  };

  callbackId = window.requestIdleCallback(callBack);
  idleCallbacks.add(callbackId);
};

const scheduleIdleTasks = () => {
  const linterEslintInstallPeerPackages = () => {
    require('atom-package-deps').install('linter-eslint');
  };

  const linterEslintStartWorker = () => {
    helpers.startWorker();
  };

  if (!atom.inSpecMode()) {
    makeIdleCallback(linterEslintInstallPeerPackages);
    makeIdleCallback(linterEslintStartWorker);
  }
}; // Configuration


const scopes = [];
let showRule;
let lintHtmlFiles;
let ignoredRulesWhenModified;
let ignoredRulesWhenFixing;
let ignoreFixableRulesWhileTyping; // Internal functions

/**
 * Given an Array or iterable containing a list of Rule IDs, return an Object
 * to be sent to ESLint's configuration that disables those rules.
 * @param  {[iterable]} ruleIds Iterable containing ruleIds to ignore
 * @return {Object}             Object containing properties for each rule to ignore
 */

const idsToIgnoredRules = ruleIds => Array.from(ruleIds).reduce( // 0 is the severity to turn off a rule
(ids, id) => Object.assign(ids, {
  [id]: 0
}), {});

module.exports = {
  activate() {
    this.subscriptions = new _atom.CompositeDisposable();
    (0, _migrateConfigOptions.migrateConfigOptions)();
    const embeddedScope = 'source.js.embedded.html';
    this.subscriptions.add(atom.config.observe('linter-eslint.lintHtmlFiles', value => {
      lintHtmlFiles = value;

      if (lintHtmlFiles) {
        scopes.push(embeddedScope);
      } else if (scopes.indexOf(embeddedScope) !== -1) {
        scopes.splice(scopes.indexOf(embeddedScope), 1);
      }
    }));
    this.subscriptions.add(atom.config.observe('linter-eslint.scopes', value => {
      // Remove any old scopes
      scopes.splice(0, scopes.length); // Add the current scopes

      Array.prototype.push.apply(scopes, value); // Ensure HTML linting still works if the setting is updated

      if (lintHtmlFiles && !scopes.includes(embeddedScope)) {
        scopes.push(embeddedScope);
      }
    }));
    this.subscriptions.add(atom.workspace.observeTextEditors(editor => {
      editor.onDidSave(async () => {
        if ((0, _editor.hasValidScope)(editor, scopes) && atom.config.get('linter-eslint.autofix.fixOnSave')) {
          await this.fixJob(true);
        }
      });
    }));
    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:debug': async () => {
        const debugString = await helpers.generateDebugString();
        const notificationOptions = {
          detail: debugString,
          dismissable: true
        };
        atom.notifications.addInfo('linter-eslint debugging information', notificationOptions);
      }
    }));
    this.subscriptions.add(atom.commands.add('atom-text-editor', {
      'linter-eslint:fix-file': async () => {
        await this.fixJob();
      }
    }));
    this.subscriptions.add(atom.config.observe('linter-eslint.advanced.showRuleIdInMessage', value => {
      showRule = value;
    }));
    this.subscriptions.add(atom.config.observe('linter-eslint.disabling.rulesToSilenceWhileTyping', ids => {
      ignoredRulesWhenModified = ids;
    }));
    this.subscriptions.add(atom.config.observe('linter-eslint.autofix.rulesToDisableWhileFixing', ids => {
      ignoredRulesWhenFixing = idsToIgnoredRules(ids);
    }));
    this.subscriptions.add(atom.config.observe('linter-eslint.autofix.ignoreFixableRulesWhileTyping', value => {
      ignoreFixableRulesWhileTyping = value;
    }));
    this.subscriptions.add(atom.contextMenu.add({
      'atom-text-editor:not(.mini), .overlayer': [{
        label: 'ESLint Fix',
        command: 'linter-eslint:fix-file',
        shouldDisplay: evt => {
          const activeEditor = atom.workspace.getActiveTextEditor();

          if (!activeEditor) {
            return false;
          } // Black magic!
          // Compares the private component property of the active TextEditor
          //   against the components of the elements


          const evtIsActiveEditor = evt.path.some(elem => // Atom v1.19.0+
          elem.component && activeEditor.component && elem.component === activeEditor.component); // Only show if it was the active editor and it is a valid scope

          return evtIsActiveEditor && (0, _editor.hasValidScope)(activeEditor, scopes);
        }
      }]
    }));
    scheduleIdleTasks();
  },

  deactivate() {
    idleCallbacks.forEach(callbackID => window.cancelIdleCallback(callbackID));
    idleCallbacks.clear();

    if (helpers) {
      // If the helpers module hasn't been loaded then there was no chance a
      // worker was started anyway.
      helpers.killWorker();
    }

    this.subscriptions.dispose();
  },

  provideLinter() {
    return {
      name: 'ESLint',
      grammarScopes: scopes,
      scope: 'file',
      lintsOnChange: true,

      /**
       * @param {import("atom").TextEditor} textEditor
       * @returns {Promise<import("atom/linter").Message[]>}
       */
      lint: async textEditor => {
        if (!atom.workspace.isTextEditor(textEditor)) {
          // If we somehow get fed an invalid TextEditor just immediately return
          return null;
        }

        if (helpers.isIncompatibleEslint()) {
          // The project's version of ESLint doesn't work with this package. Once
          // this is detected, we won't try to send any jobs until the window is
          // reloaded.
          return null;
        }

        const filePath = textEditor.getPath();

        if (!filePath) {
          // The editor currently has no path, we can't report messages back to
          // Linter so just return null
          return null;
        }

        if (filePath.includes('://')) {
          // If the path is a URL (Nuclide remote file) return a message
          // telling the user we are unable to work on remote files.
          return helpers.generateUserMessage(textEditor, {
            severity: 'warning',
            excerpt: 'Remote file open, linter-eslint is disabled for this file.'
          });
        }

        const text = textEditor.getText();
        let rules = {};

        if (textEditor.isModified()) {
          if (ignoreFixableRulesWhileTyping) {
            // Note that the fixable rules will only have values after the first lint job
            const ignoredRules = new Set(helpers.rules.getFixableRules());
            ignoredRulesWhenModified.forEach(ruleId => ignoredRules.add(ruleId));
            rules = idsToIgnoredRules(ignoredRules);
          } else {
            rules = idsToIgnoredRules(ignoredRulesWhenModified);
          }
        }

        try {
          const response = await helpers.sendJob({
            type: 'lint',
            contents: text,
            config: atom.config.get('linter-eslint'),
            rules,
            filePath,
            projectPath: atom.project.relativizePath(filePath)[0] || ''
          });

          if (textEditor.getText() !== text) {
            /*
            The editor text has been modified since the lint was triggered,
            as we can't be sure that the results will map properly back to
            the new contents, simply return `null` to tell the
            `provideLinter` consumer not to update the saved results.
            */
            return null;
          }

          return helpers.processJobResponse(response, textEditor, showRule);
        } catch (error) {
          return helpers.handleError(textEditor, error);
        }
      }
    };
  },

  async fixJob(isSave = false) {
    const textEditor = atom.workspace.getActiveTextEditor();

    if (!textEditor || !atom.workspace.isTextEditor(textEditor)) {
      // Silently return if the TextEditor is invalid
      return;
    }

    if (helpers.isIncompatibleEslint()) {
      // The project's version of ESLint doesn't work with this package. Once
      // this is detected, we won't try to send any jobs until the window is
      // reloaded.
      return;
    }

    if (textEditor.isModified()) {
      // Abort for invalid or unsaved text editors
      const message = 'Linter-ESLint: Please save before fixing';
      atom.notifications.addError(message);
    }

    const filePath = textEditor.getPath();
    const projectPath = atom.project.relativizePath(filePath)[0]; // Get the text from the editor, so we can use executeOnText

    const text = textEditor.getText(); // Do not try to make fixes on an empty file

    if (text.length === 0) {
      return;
    }

    let rules = {};

    if (Object.keys(ignoredRulesWhenFixing).length > 0) {
      rules = ignoredRulesWhenFixing;
    }

    try {
      const response = await helpers.sendJob({
        type: 'fix',
        config: atom.config.get('linter-eslint'),
        contents: text,
        rules,
        filePath,
        projectPath
      });

      if (!isSave) {
        atom.notifications.addSuccess(response);
      }
    } catch (err) {
      if (err.name === 'IncompatibleESLintError') {
        return;
      }

      atom.notifications.addWarning(err.message);
    }
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9tYWluLmpzIl0sIm5hbWVzIjpbImlkbGVDYWxsYmFja3MiLCJTZXQiLCJtYWtlSWRsZUNhbGxiYWNrIiwid29yayIsImNhbGxiYWNrSWQiLCJjYWxsQmFjayIsImRlbGV0ZSIsIndpbmRvdyIsInJlcXVlc3RJZGxlQ2FsbGJhY2siLCJhZGQiLCJzY2hlZHVsZUlkbGVUYXNrcyIsImxpbnRlckVzbGludEluc3RhbGxQZWVyUGFja2FnZXMiLCJyZXF1aXJlIiwiaW5zdGFsbCIsImxpbnRlckVzbGludFN0YXJ0V29ya2VyIiwiaGVscGVycyIsInN0YXJ0V29ya2VyIiwiYXRvbSIsImluU3BlY01vZGUiLCJzY29wZXMiLCJzaG93UnVsZSIsImxpbnRIdG1sRmlsZXMiLCJpZ25vcmVkUnVsZXNXaGVuTW9kaWZpZWQiLCJpZ25vcmVkUnVsZXNXaGVuRml4aW5nIiwiaWdub3JlRml4YWJsZVJ1bGVzV2hpbGVUeXBpbmciLCJpZHNUb0lnbm9yZWRSdWxlcyIsInJ1bGVJZHMiLCJBcnJheSIsImZyb20iLCJyZWR1Y2UiLCJpZHMiLCJpZCIsIk9iamVjdCIsImFzc2lnbiIsIm1vZHVsZSIsImV4cG9ydHMiLCJhY3RpdmF0ZSIsInN1YnNjcmlwdGlvbnMiLCJDb21wb3NpdGVEaXNwb3NhYmxlIiwiZW1iZWRkZWRTY29wZSIsImNvbmZpZyIsIm9ic2VydmUiLCJ2YWx1ZSIsInB1c2giLCJpbmRleE9mIiwic3BsaWNlIiwibGVuZ3RoIiwicHJvdG90eXBlIiwiYXBwbHkiLCJpbmNsdWRlcyIsIndvcmtzcGFjZSIsIm9ic2VydmVUZXh0RWRpdG9ycyIsImVkaXRvciIsIm9uRGlkU2F2ZSIsImdldCIsImZpeEpvYiIsImNvbW1hbmRzIiwiZGVidWdTdHJpbmciLCJnZW5lcmF0ZURlYnVnU3RyaW5nIiwibm90aWZpY2F0aW9uT3B0aW9ucyIsImRldGFpbCIsImRpc21pc3NhYmxlIiwibm90aWZpY2F0aW9ucyIsImFkZEluZm8iLCJjb250ZXh0TWVudSIsImxhYmVsIiwiY29tbWFuZCIsInNob3VsZERpc3BsYXkiLCJldnQiLCJhY3RpdmVFZGl0b3IiLCJnZXRBY3RpdmVUZXh0RWRpdG9yIiwiZXZ0SXNBY3RpdmVFZGl0b3IiLCJwYXRoIiwic29tZSIsImVsZW0iLCJjb21wb25lbnQiLCJkZWFjdGl2YXRlIiwiZm9yRWFjaCIsImNhbGxiYWNrSUQiLCJjYW5jZWxJZGxlQ2FsbGJhY2siLCJjbGVhciIsImtpbGxXb3JrZXIiLCJkaXNwb3NlIiwicHJvdmlkZUxpbnRlciIsIm5hbWUiLCJncmFtbWFyU2NvcGVzIiwic2NvcGUiLCJsaW50c09uQ2hhbmdlIiwibGludCIsInRleHRFZGl0b3IiLCJpc1RleHRFZGl0b3IiLCJpc0luY29tcGF0aWJsZUVzbGludCIsImZpbGVQYXRoIiwiZ2V0UGF0aCIsImdlbmVyYXRlVXNlck1lc3NhZ2UiLCJzZXZlcml0eSIsImV4Y2VycHQiLCJ0ZXh0IiwiZ2V0VGV4dCIsInJ1bGVzIiwiaXNNb2RpZmllZCIsImlnbm9yZWRSdWxlcyIsImdldEZpeGFibGVSdWxlcyIsInJ1bGVJZCIsInJlc3BvbnNlIiwic2VuZEpvYiIsInR5cGUiLCJjb250ZW50cyIsInByb2plY3RQYXRoIiwicHJvamVjdCIsInJlbGF0aXZpemVQYXRoIiwicHJvY2Vzc0pvYlJlc3BvbnNlIiwiZXJyb3IiLCJoYW5kbGVFcnJvciIsImlzU2F2ZSIsIm1lc3NhZ2UiLCJhZGRFcnJvciIsImtleXMiLCJhZGRTdWNjZXNzIiwiZXJyIiwiYWRkV2FybmluZyJdLCJtYXBwaW5ncyI6Ijs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7Ozs7O0FBSkE7QUFNQTtBQUNBLE1BQU1BLGFBQWEsR0FBRyxJQUFJQyxHQUFKLEVBQXRCOztBQUVBLE1BQU1DLGdCQUFnQixHQUFJQyxJQUFELElBQVU7QUFDakMsTUFBSUMsVUFBSjs7QUFDQSxRQUFNQyxRQUFRLEdBQUcsTUFBTTtBQUNyQkwsSUFBQUEsYUFBYSxDQUFDTSxNQUFkLENBQXFCRixVQUFyQjtBQUNBRCxJQUFBQSxJQUFJO0FB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QVgsRUFBYixDQXpCMkIsQ0EwQjNCOztBQUNBLFFBQUlELElBQUksQ0FBQ25ELE1BQUwsS0FBZ0IsQ0FBcEIsRUFBdUI7QUFDckI7QUFDRDs7QUFFRCxRQUFJcUQsS0FBSyxHQUFHLEVBQVo7O0FBQ0EsUUFBSW5FLE1BQU0sQ0FBQ3FGLElBQVAsQ0FBWTlGLHNCQUFaLEVBQW9DdUIsTUFBcEMsR0FBNkMsQ0FBakQsRUFBb0Q7QUFDbERxRCxNQUFBQSxLQUFLLEdBQUc1RSxzQkFBUjtBQUNEOztBQUVELFFBQUk7QUFDRixZQUFNaUYsUUFBUSxHQUFHLE1BQU16RixPQUFPLENBQUMwRixPQUFSLENBQWdCO0FBQ3JDQyxRQUFBQSxJQUFJLEVBQUUsS0FEK0I7QUFFckNsRSxRQUFBQSxNQUFNLEVBQUV2QixJQUFJLENBQUN1QixNQUFMLENBQVljLEdBQVosQ0FBZ0IsZUFBaEIsQ0FGNkI7QUFHckNxRCxRQUFBQSxRQUFRLEVBQUVWLElBSDJCO0FBSXJDRSxRQUFBQSxLQUpxQztBQUtyQ1AsUUFBQUEsUUFMcUM7QUFNckNnQixRQUFBQTtBQU5xQyxPQUFoQixDQUF2Qjs7QUFRQSxVQUFJLENBQUNNLE1BQUwsRUFBYTtBQUNYakcsUUFBQUEsSUFBSSxDQUFDNkMsYUFBTCxDQUFtQndELFVBQW5CLENBQThCZCxRQUE5QjtBQUNEO0FBQ0YsS0FaRCxDQVlFLE9BQU9lLEdBQVAsRUFBWTtBQUNaLFVBQUlBLEdBQUcsQ0FBQ25DLElBQUosS0FBYSx5QkFBakIsRUFBNEM7QUFDMUM7QUFDRDs7QUFDRG5FLE1BQUFBLElBQUksQ0FBQzZDLGFBQUwsQ0FBbUIwRCxVQUFuQixDQUE4QkQsR0FBRyxDQUFDSixPQUFsQztBQUNEO0FBQ0Y7O0FBdFBjLENBQWpCIiwic291cmNlc0NvbnRlbnQiOlsiLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1leHRyYW5lb3VzLWRlcGVuZGVuY2llcywgaW1wb3J0L2V4dGVuc2lvbnNcbmltcG9ydCB7IENvbXBvc2l0ZURpc3Bvc2FibGUgfSBmcm9tICdhdG9tJ1xuaW1wb3J0IHsgaGFzVmFsaWRTY29wZSB9IGZyb20gJy4vdmFsaWRhdGUvZWRpdG9yJ1xuaW1wb3J0ICogYXMgaGVscGVycyBmcm9tICcuL2hlbHBlcnMnXG5pbXBvcnQgeyBtaWdyYXRlQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4vbWlncmF0ZS1jb25maWctb3B0aW9ucydcblxuLy8gSW50ZXJuYWwgdmFyaWFibGVzXG5jb25zdCBpZGxlQ2FsbGJhY2tzID0gbmV3IFNldCgpXG5cbmNvbnN0IG1ha2VJZGxlQ2FsbGJhY2sgPSAod29yaykgPT4ge1xuICBsZXQgY2FsbGJhY2tJZFxuICBjb25zdCBjYWxsQmFjayA9ICgpID0+IHtcbiAgICBpZGxlQ2FsbGJhY2tzLmRlbGV0ZShjYWxsYmFja0lkKVxuICAgIHdvcmsoKVxuICB9XG4gIGNhbGxiYWNrSWQgPSB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFjayhjYWxsQmFjaylcbiAgaWRsZUNhbGxiYWNrcy5hZGQoY2FsbGJhY2tJZClcbn1cblxuY29uc3Qgc2NoZWR1bGVJZGxlVGFza3MgPSAoKSA9PiB7XG4gIGNvbnN0IGxpbnRlckVzbGludEluc3RhbGxQZWVyUGFja2FnZXMgPSAoKSA9PiB7XG4gICAgcmVxdWlyZSgnYXRvbS1wYWNrYWdlLWRlcHMnKS5pbnN0YWxsKCdsaW50ZXItZXNsaW50JylcbiAgfVxuICBjb25zdCBsaW50ZXJFc2xpbnRTdGFydFdvcmtlciA9ICgpID0+IHtcbiAgICBoZWxwZXJzLnN0YXJ0V29ya2VyKClcbiAgfVxuXG4gIGlmICghYXRvbS5pblNwZWNNb2RlKCkpIHtcbiAgICBtYWtlSWRsZUNhbGxiYWNrKGxpbnRlckVzbGludEluc3RhbGxQZWVyUGFja2FnZXMpXG4gICAgbWFrZUlkbGVDYWxsYmFjayhsaW50ZXJFc2xpbnRTdGFydFdvcmtlcilcbiAgfVxufVxuXG4vLyBDb25maWd1cmF0aW9uXG5jb25zdCBzY29wZXMgPSBbXVxubGV0IHNob3dSdWxlXG5sZXQgbGludEh0bWxGaWxlc1xubGV0IGlnbm9yZWRSdWxlc1doZW5Nb2RpZmllZFxubGV0IGlnbm9yZWRSdWxlc1doZW5GaXhpbmdcbmxldCBpZ25vcmVGaXhhYmxlUnVsZXNXaGlsZVR5cGluZ1xuXG4vLyBJbnRlcm5hbCBmdW5jdGlvbnNcbi8qKlxuICogR2l2ZW4gYW4gQXJyYXkgb3IgaXRlcmFibGUgY29udGFpbmluZyBhIGxpc3Qgb2YgUnVsZSBJRHMsIHJldHVybiBhbiBPYmplY3RcbiAqIHRvIGJlIHNlbnQgdG8gRVNMaW50J3MgY29uZmlndXJhdGlvbiB0aGF0IGRpc2FibGVzIHRob3NlIHJ1bGVzLlxuICogQHBhcmFtICB7W2l0ZXJhYmxlXX0gcnVsZUlkcyBJdGVyYWJsZSBjb250YWluaW5nIHJ1bGVJZHMgdG8gaWdub3JlXG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICAgIE9iamVjdCBjb250YWluaW5nIHByb3BlcnRpZXMgZm9yIGVhY2ggcnVsZSB0byBpZ25vcmVcbiAqL1xuY29uc3QgaWRzVG9JZ25vcmVkUnVsZXMgPSAocnVsZUlkcykgPT4gKFxuICBBcnJheS5mcm9tKHJ1bGVJZHMpLnJlZHVjZShcbiAgICAvLyAwIGlzIHRoZSBzZXZlcml0eSB0byB0dXJuIG9mZiBhIHJ1bGVcbiAgICAoaWRzLCBpZCkgPT4gT2JqZWN0LmFzc2lnbihpZHMsIHsgW2lkXTogMCB9KSxcbiAgICB7fVxuICApKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgYWN0aXZhdGUoKSB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25zID0gbmV3IENvbXBvc2l0ZURpc3Bvc2FibGUoKVxuXG4gICAgbWlncmF0ZUNvbmZpZ09wdGlvbnMoKVxuXG4gICAgY29uc3QgZW1iZWRkZWRTY29wZSA9ICdzb3VyY2UuanMuZW1iZWRkZWQuaHRtbCdcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoXG4gICAgICAnbGludGVyLWVzbGludC5saW50SHRtbEZpbGVzJyxcbiAgICAgICh2YWx1ZSkgPT4ge1xuICAgICAgICBsaW50SHRtbEZpbGVzID0gdmFsdWVcbiAgICAgICAgaWYgKGxpbnRIdG1sRmlsZXMpIHtcbiAgICAgICAgICBzY29wZXMucHVzaChlbWJlZGRlZFNjb3BlKVxuICAgICAgICB9IGVsc2UgaWYgKHNjb3Blcy5pbmRleE9mKGVtYmVkZGVkU2NvcGUpICE9PSAtMSkge1xuICAgICAgICAgIHNjb3Blcy5zcGxpY2Uoc2NvcGVzLmluZGV4T2YoZW1iZWRkZWRTY29wZSksIDEpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApKVxuXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKFxuICAgICAgJ2xpbnRlci1lc2xpbnQuc2NvcGVzJyxcbiAgICAgICh2YWx1ZSkgPT4ge1xuICAgICAgICAvLyBSZW1vdmUgYW55IG9sZCBzY29wZXNcbiAgICAgICAgc2NvcGVzLnNwbGljZSgwLCBzY29wZXMubGVuZ3RoKVxuICAgICAgICAvLyBBZGQgdGhlIGN1cnJlbnQgc2NvcGVzXG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHNjb3BlcywgdmFsdWUpXG4gICAgICAgIC8vIEVuc3VyZSBIVE1MIGxpbnRpbmcgc3RpbGwgd29ya3MgaWYgdGhlIHNldHRpbmcgaXMgdXBkYXRlZFxuICAgICAgICBpZiAobGludEh0bWxGaWxlcyAmJiAhc2NvcGVzLmluY2x1ZGVzKGVtYmVkZGVkU2NvcGUpKSB7XG4gICAgICAgICAgc2NvcGVzLnB1c2goZW1iZWRkZWRTY29wZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICkpXG5cbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGF0b20ud29ya3NwYWNlLm9ic2VydmVUZXh0RWRpdG9ycygoZWRpdG9yKSA9PiB7XG4gICAgICBlZGl0b3Iub25EaWRTYXZlKGFzeW5jICgpID0+IHtcbiAgICAgICAgaWYgKGhhc1ZhbGlkU2NvcGUoZWRpdG9yLCBzY29wZXMpXG4gICAgICAgICAgJiYgYXRvbS5jb25maWcuZ2V0KCdsaW50ZXItZXNsaW50LmF1dG9maXguZml4T25TYXZlJylcbiAgICAgICAgKSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5maXhKb2IodHJ1ZSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9KSlcblxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3InLCB7XG4gICAgICAnbGludGVyLWVzbGludDpkZWJ1Zyc6IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgZGVidWdTdHJpbmcgPSBhd2FpdCBoZWxwZXJzLmdlbmVyYXRlRGVidWdTdHJpbmcoKVxuICAgICAgICBjb25zdCBub3RpZmljYXRpb25PcHRpb25zID0geyBkZXRhaWw6IGRlYnVnU3RyaW5nLCBkaXNtaXNzYWJsZTogdHJ1ZSB9XG4gICAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRJbmZvKCdsaW50ZXItZXNsaW50IGRlYnVnZ2luZyBpbmZvcm1hdGlvbicsIG5vdGlmaWNhdGlvbk9wdGlvbnMpXG4gICAgICB9XG4gICAgfSkpXG5cbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yJywge1xuICAgICAgJ2xpbnRlci1lc2xpbnQ6Zml4LWZpbGUnOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuZml4Sm9iKClcbiAgICAgIH1cbiAgICB9KSlcblxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZShcbiAgICAgICdsaW50ZXItZXNsaW50LmFkdmFuY2VkLnNob3dSdWxlSWRJbk1lc3NhZ2UnLFxuICAgICAgKHZhbHVlKSA9PiB7IHNob3dSdWxlID0gdmFsdWUgfVxuICAgICkpXG5cbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoXG4gICAgICAnbGludGVyLWVzbGludC5kaXNhYmxpbmcucnVsZXNUb1NpbGVuY2VXaGlsZVR5cGluZycsXG4gICAgICAoaWRzKSA9PiB7IGlnbm9yZWRSdWxlc1doZW5Nb2RpZmllZCA9IGlkcyB9XG4gICAgKSlcblxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZShcbiAgICAgICdsaW50ZXItZXNsaW50LmF1dG9maXgucnVsZXNUb0Rpc2FibGVXaGlsZUZpeGluZycsXG4gICAgICAoaWRzKSA9PiB7IGlnbm9yZWRSdWxlc1doZW5GaXhpbmcgPSBpZHNUb0lnbm9yZWRSdWxlcyhpZHMpIH1cbiAgICApKVxuXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKFxuICAgICAgJ2xpbnRlci1lc2xpbnQuYXV0b2ZpeC5pZ25vcmVGaXhhYmxlUnVsZXNXaGlsZVR5cGluZycsXG4gICAgICAodmFsdWUpID0+IHsgaWdub3JlRml4YWJsZVJ1bGVzV2hpbGVUeXBpbmcgPSB2YWx1ZSB9XG4gICAgKSlcblxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoYXRvbS5jb250ZXh0TWVudS5hZGQoe1xuICAgICAgJ2F0b20tdGV4dC1lZGl0b3I6bm90KC5taW5pKSwgLm92ZXJsYXllcic6IFt7XG4gICAgICAgIGxhYmVsOiAnRVNMaW50IEZpeCcsXG4gICAgICAgIGNvbW1hbmQ6ICdsaW50ZXItZXNsaW50OmZpeC1maWxlJyxcbiAgICAgICAgc2hvdWxkRGlzcGxheTogKGV2dCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGFjdGl2ZUVkaXRvciA9IGF0b20ud29ya3NwYWNlLmdldEFjdGl2ZVRleHRFZGl0b3IoKVxuICAgICAgICAgIGlmICghYWN0aXZlRWRpdG9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gQmxhY2sgbWFnaWMhXG4gICAgICAgICAgLy8gQ29tcGFyZXMgdGhlIHByaXZhdGUgY29tcG9uZW50IHByb3BlcnR5IG9mIHRoZSBhY3RpdmUgVGV4dEVkaXRvclxuICAgICAgICAgIC8vICAgYWdhaW5zdCB0aGUgY29tcG9uZW50cyBvZiB0aGUgZWxlbWVudHNcbiAgICAgICAgICBjb25zdCBldnRJc0FjdGl2ZUVkaXRvciA9IGV2dC5wYXRoLnNvbWUoKGVsZW0pID0+IChcbiAgICAgICAgICAgIC8vIEF0b20gdjEuMTkuMCtcbiAgICAgICAgICAgIGVsZW0uY29tcG9uZW50ICYmIGFjdGl2ZUVkaXRvci5jb21wb25lbnRcbiAgICAgICAgICAgICAgJiYgZWxlbS5jb21wb25lbnQgPT09IGFjdGl2ZUVkaXRvci5jb21wb25lbnQpKVxuICAgICAgICAgIC8vIE9ubHkgc2hvdyBpZiBpdCB3YXMgdGhlIGFjdGl2ZSBlZGl0b3IgYW5kIGl0IGlzIGEgdmFsaWQgc2NvcGVcbiAgICAgICAgICByZXR1cm4gZXZ0SXNBY3RpdmVFZGl0b3IgJiYgaGFzVmFsaWRTY29wZShhY3RpdmVFZGl0b3IsIHNjb3BlcylcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9KSlcblxuICAgIHNjaGVkdWxlSWRsZVRhc2tzKClcbiAgfSxcblxuICBkZWFjdGl2YXRlKCkge1xuICAgIGlkbGVDYWxsYmFja3MuZm9yRWFjaCgoY2FsbGJhY2tJRCkgPT4gd2luZG93LmNhbmNlbElkbGVDYWxsYmFjayhjYWxsYmFja0lEKSlcbiAgICBpZGxlQ2FsbGJhY2tzLmNsZWFyKClcbiAgICBpZiAoaGVscGVycykge1xuICAgICAgLy8gSWYgdGhlIGhlbHBlcnMgbW9kdWxlIGhhc24ndCBiZWVuIGxvYWRlZCB0aGVuIHRoZXJlIHdhcyBubyBjaGFuY2UgYVxuICAgICAgLy8gd29ya2VyIHdhcyBzdGFydGVkIGFueXdheS5cbiAgICAgIGhlbHBlcnMua2lsbFdvcmtlcigpXG4gICAgfVxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5kaXNwb3NlKClcbiAgfSxcblxuICBwcm92aWRlTGludGVyKCkge1xuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiAnRVNMaW50JyxcbiAgICAgIGdyYW1tYXJTY29wZXM6IHNjb3BlcyxcbiAgICAgIHNjb3BlOiAnZmlsZScsXG4gICAgICBsaW50c09uQ2hhbmdlOiB0cnVlLFxuICAgICAgLyoqXG4gICAgICAgKiBAcGFyYW0ge2ltcG9ydChcImF0b21cIikuVGV4dEVkaXRvcn0gdGV4dEVkaXRvclxuICAgICAgICogQHJldHVybnMge1Byb21pc2U8aW1wb3J0KFwiYXRvbS9saW50ZXJcIikuTWVzc2FnZVtdPn1cbiAgICAgICAqL1xuICAgICAgbGludDogYXN5bmMgKHRleHRFZGl0b3IpID0+IHtcbiAgICAgICAgaWYgKCFhdG9tLndvcmtzcGFjZS5pc1RleHRFZGl0b3IodGV4dEVkaXRvcikpIHtcbiAgICAgICAgICAvLyBJZiB3ZSBzb21laG93IGdldCBmZWQgYW4gaW52YWxpZCBUZXh0RWRpdG9yIGp1c3QgaW1tZWRpYXRlbHkgcmV0dXJuXG4gICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChoZWxwZXJzLmlzSW5jb21wYXRpYmxlRXNsaW50KCkpIHtcbiAgICAgICAgICAvLyBUaGUgcHJvamVjdCdzIHZlcnNpb24gb2YgRVNMaW50IGRvZXNuJ3Qgd29yayB3aXRoIHRoaXMgcGFja2FnZS4gT25jZVxuICAgICAgICAgIC8vIHRoaXMgaXMgZGV0ZWN0ZWQsIHdlIHdvbid0IHRyeSB0byBzZW5kIGFueSBqb2JzIHVudGlsIHRoZSB3aW5kb3cgaXNcbiAgICAgICAgICAvLyByZWxvYWRlZC5cbiAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZmlsZVBhdGggPSB0ZXh0RWRpdG9yLmdldFBhdGgoKVxuICAgICAgICBpZiAoIWZpbGVQYXRoKSB7XG4gICAgICAgICAgLy8gVGhlIGVkaXRvciBjdXJyZW50bHkgaGFzIG5vIHBhdGgsIHdlIGNhbid0IHJlcG9ydCBtZXNzYWdlcyBiYWNrIHRvXG4gICAgICAgICAgLy8gTGludGVyIHNvIGp1c3QgcmV0dXJuIG51bGxcbiAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZpbGVQYXRoLmluY2x1ZGVzKCc6Ly8nKSkge1xuICAgICAgICAgIC8vIElmIHRoZSBwYXRoIGlzIGEgVVJMIChOdWNsaWRlIHJlbW90ZSBmaWxlKSByZXR1cm4gYSBtZXNzYWdlXG4gICAgICAgICAgLy8gdGVsbGluZyB0aGUgdXNlciB3ZSBhcmUgdW5hYmxlIHRvIHdvcmsgb24gcmVtb3RlIGZpbGVzLlxuICAgICAgICAgIHJldHVybiBoZWxwZXJzLmdlbmVyYXRlVXNlck1lc3NhZ2UodGV4dEVkaXRvciwge1xuICAgICAgICAgICAgc2V2ZXJpdHk6ICd3YXJuaW5nJyxcbiAgICAgICAgICAgIGV4Y2VycHQ6ICdSZW1vdGUgZmlsZSBvcGVuLCBsaW50ZXItZXNsaW50IGlzIGRpc2FibGVkIGZvciB0aGlzIGZpbGUuJyxcbiAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGV4dCA9IHRleHRFZGl0b3IuZ2V0VGV4dCgpXG5cbiAgICAgICAgbGV0IHJ1bGVzID0ge31cbiAgICAgICAgaWYgKHRleHRFZGl0b3IuaXNNb2RpZmllZCgpKSB7XG4gICAgICAgICAgaWYgKGlnbm9yZUZpeGFibGVSdWxlc1doaWxlVHlwaW5nKSB7XG4gICAgICAgICAgICAvLyBOb3RlIHRoYXQgdGhlIGZpeGFibGUgcnVsZXMgd2lsbCBvbmx5IGhhdmUgdmFsdWVzIGFmdGVyIHRoZSBmaXJzdCBsaW50IGpvYlxuICAgICAgICAgICAgY29uc3QgaWdub3JlZFJ1bGVzID0gbmV3IFNldChoZWxwZXJzLnJ1bGVzLmdldEZpeGFibGVSdWxlcygpKVxuICAgICAgICAgICAgaWdub3JlZFJ1bGVzV2hlbk1vZGlmaWVkLmZvckVhY2goKHJ1bGVJZCkgPT4gaWdub3JlZFJ1bGVzLmFkZChydWxlSWQpKVxuICAgICAgICAgICAgcnVsZXMgPSBpZHNUb0lnbm9yZWRSdWxlcyhpZ25vcmVkUnVsZXMpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJ1bGVzID0gaWRzVG9JZ25vcmVkUnVsZXMoaWdub3JlZFJ1bGVzV2hlbk1vZGlmaWVkKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBoZWxwZXJzLnNlbmRKb2Ioe1xuICAgICAgICAgICAgdHlwZTogJ2xpbnQnLFxuICAgICAgICAgICAgY29udGVudHM6IHRleHQsXG4gICAgICAgICAgICBjb25maWc6IGF0b20uY29uZmlnLmdldCgnbGludGVyLWVzbGludCcpLFxuICAgICAgICAgICAgcnVsZXMsXG4gICAgICAgICAgICBmaWxlUGF0aCxcbiAgICAgICAgICAgIHByb2plY3RQYXRoOiBhdG9tLnByb2plY3QucmVsYXRpdml6ZVBhdGgoZmlsZVBhdGgpWzBdIHx8ICcnXG4gICAgICAgICAgfSlcbiAgICAgICAgICBpZiAodGV4dEVkaXRvci5nZXRUZXh0KCkgIT09IHRleHQpIHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICBUaGUgZWRpdG9yIHRleHQgaGFzIGJlZW4gbW9kaWZpZWQgc2luY2UgdGhlIGxpbnQgd2FzIHRyaWdnZXJlZCxcbiAgICAgICAgICAgIGFzIHdlIGNhbid0IGJlIHN1cmUgdGhhdCB0aGUgcmVzdWx0cyB3aWxsIG1hcCBwcm9wZXJseSBiYWNrIHRvXG4gICAgICAgICAgICB0aGUgbmV3IGNvbnRlbnRzLCBzaW1wbHkgcmV0dXJuIGBudWxsYCB0byB0ZWxsIHRoZVxuICAgICAgICAgICAgYHByb3ZpZGVMaW50ZXJgIGNvbnN1bWVyIG5vdCB0byB1cGRhdGUgdGhlIHNhdmVkIHJlc3VsdHMuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGhlbHBlcnMucHJvY2Vzc0pvYlJlc3BvbnNlKHJlc3BvbnNlLCB0ZXh0RWRpdG9yLCBzaG93UnVsZSlcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gaGVscGVycy5oYW5kbGVFcnJvcih0ZXh0RWRpdG9yLCBlcnJvcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBhc3luYyBmaXhKb2IoaXNTYXZlID0gZmFsc2UpIHtcbiAgICBjb25zdCB0ZXh0RWRpdG9yID0gYXRvbS53b3Jrc3BhY2UuZ2V0QWN0aXZlVGV4dEVkaXRvcigpXG5cbiAgICBpZiAoIXRleHRFZGl0b3IgfHwgIWF0b20ud29ya3NwYWNlLmlzVGV4dEVkaXRvcih0ZXh0RWRpdG9yKSkge1xuICAgICAgLy8gU2lsZW50bHkgcmV0dXJuIGlmIHRoZSBUZXh0RWRpdG9yIGlzIGludmFsaWRcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChoZWxwZXJzLmlzSW5jb21wYXRpYmxlRXNsaW50KCkpIHtcbiAgICAgIC8vIFRoZSBwcm9qZWN0J3MgdmVyc2lvbiBvZiBFU0xpbnQgZG9lc24ndCB3b3JrIHdpdGggdGhpcyBwYWNrYWdlLiBPbmNlXG4gICAgICAvLyB0aGlzIGlzIGRldGVjdGVkLCB3ZSB3b24ndCB0cnkgdG8gc2VuZCBhbnkgam9icyB1bnRpbCB0aGUgd2luZG93IGlzXG4gICAgICAvLyByZWxvYWRlZC5cbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmICh0ZXh0RWRpdG9yLmlzTW9kaWZpZWQoKSkge1xuICAgICAgLy8gQWJvcnQgZm9yIGludmFsaWQgb3IgdW5zYXZlZCB0ZXh0IGVkaXRvcnNcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSAnTGludGVyLUVTTGludDogUGxlYXNlIHNhdmUgYmVmb3JlIGZpeGluZydcbiAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRFcnJvcihtZXNzYWdlKVxuICAgIH1cblxuICAgIGNvbnN0IGZpbGVQYXRoID0gdGV4dEVkaXRvci5nZXRQYXRoKClcbiAgICBjb25zdCBwcm9qZWN0UGF0aCA9IGF0b20ucHJvamVjdC5yZWxhdGl2aXplUGF0aChmaWxlUGF0aClbMF1cblxuICAgIC8vIEdldCB0aGUgdGV4dCBmcm9tIHRoZSBlZGl0b3IsIHNvIHdlIGNhbiB1c2UgZXhlY3V0ZU9uVGV4dFxuICAgIGNvbnN0IHRleHQgPSB0ZXh0RWRpdG9yLmdldFRleHQoKVxuICAgIC8vIERvIG5vdCB0cnkgdG8gbWFrZSBmaXhlcyBvbiBhbiBlbXB0eSBmaWxlXG4gICAgaWYgKHRleHQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBsZXQgcnVsZXMgPSB7fVxuICAgIGlmIChPYmplY3Qua2V5cyhpZ25vcmVkUnVsZXNXaGVuRml4aW5nKS5sZW5ndGggPiAwKSB7XG4gICAgICBydWxlcyA9IGlnbm9yZWRSdWxlc1doZW5GaXhpbmdcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBoZWxwZXJzLnNlbmRKb2Ioe1xuICAgICAgICB0eXBlOiAnZml4JyxcbiAgICAgICAgY29uZmlnOiBhdG9tLmNvbmZpZy5nZXQoJ2xpbnRlci1lc2xpbnQnKSxcbiAgICAgICAgY29udGVudHM6IHRleHQsXG4gICAgICAgIHJ1bGVzLFxuICAgICAgICBmaWxlUGF0aCxcbiAgICAgICAgcHJvamVjdFBhdGhcbiAgICAgIH0pXG4gICAgICBpZiAoIWlzU2F2ZSkge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkU3VjY2VzcyhyZXNwb25zZSlcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIubmFtZSA9PT0gJ0luY29tcGF0aWJsZUVTTGludEVycm9yJykge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKGVyci5tZXNzYWdlKVxuICAgIH1cbiAgfSxcbn1cbiJdfQ==