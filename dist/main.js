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
      atom.notifications.addWarning(err.message);
    }
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9tYWluLmpzIl0sIm5hbWVzIjpbImlkbGVDYWxsYmFja3MiLCJTZXQiLCJtYWtlSWRsZUNhbGxiYWNrIiwid29yayIsImNhbGxiYWNrSWQiLCJjYWxsQmFjayIsImRlbGV0ZSIsIndpbmRvdyIsInJlcXVlc3RJZGxlQ2FsbGJhY2siLCJhZGQiLCJzY2hlZHVsZUlkbGVUYXNrcyIsImxpbnRlckVzbGludEluc3RhbGxQZWVyUGFja2FnZXMiLCJyZXF1aXJlIiwiaW5zdGFsbCIsImxpbnRlckVzbGludFN0YXJ0V29ya2VyIiwiaGVscGVycyIsInN0YXJ0V29ya2VyIiwiYXRvbSIsImluU3BlY01vZGUiLCJzY29wZXMiLCJzaG93UnVsZSIsImxpbnRIdG1sRmlsZXMiLCJpZ25vcmVkUnVsZXNXaGVuTW9kaWZpZWQiLCJpZ25vcmVkUnVsZXNXaGVuRml4aW5nIiwiaWdub3JlRml4YWJsZVJ1bGVzV2hpbGVUeXBpbmciLCJpZHNUb0lnbm9yZWRSdWxlcyIsInJ1bGVJZHMiLCJBcnJheSIsImZyb20iLCJyZWR1Y2UiLCJpZHMiLCJpZCIsIk9iamVjdCIsImFzc2lnbiIsIm1vZHVsZSIsImV4cG9ydHMiLCJhY3RpdmF0ZSIsInN1YnNjcmlwdGlvbnMiLCJDb21wb3NpdGVEaXNwb3NhYmxlIiwiZW1iZWRkZWRTY29wZSIsImNvbmZpZyIsIm9ic2VydmUiLCJ2YWx1ZSIsInB1c2giLCJpbmRleE9mIiwic3BsaWNlIiwibGVuZ3RoIiwicHJvdG90eXBlIiwiYXBwbHkiLCJpbmNsdWRlcyIsIndvcmtzcGFjZSIsIm9ic2VydmVUZXh0RWRpdG9ycyIsImVkaXRvciIsIm9uRGlkU2F2ZSIsImdldCIsImZpeEpvYiIsImNvbW1hbmRzIiwiZGVidWdTdHJpbmciLCJnZW5lcmF0ZURlYnVnU3RyaW5nIiwibm90aWZpY2F0aW9uT3B0aW9ucyIsImRldGFpbCIsImRpc21pc3NhYmxlIiwibm90aWZpY2F0aW9ucyIsImFkZEluZm8iLCJjb250ZXh0TWVudSIsImxhYmVsIiwiY29tbWFuZCIsInNob3VsZERpc3BsYXkiLCJldnQiLCJhY3RpdmVFZGl0b3IiLCJnZXRBY3RpdmVUZXh0RWRpdG9yIiwiZXZ0SXNBY3RpdmVFZGl0b3IiLCJwYXRoIiwic29tZSIsImVsZW0iLCJjb21wb25lbnQiLCJkZWFjdGl2YXRlIiwiZm9yRWFjaCIsImNhbGxiYWNrSUQiLCJjYW5jZWxJZGxlQ2FsbGJhY2siLCJjbGVhciIsImtpbGxXb3JrZXIiLCJkaXNwb3NlIiwicHJvdmlkZUxpbnRlciIsIm5hbWUiLCJncmFtbWFyU2NvcGVzIiwic2NvcGUiLCJsaW50c09uQ2hhbmdlIiwibGludCIsInRleHRFZGl0b3IiLCJpc1RleHRFZGl0b3IiLCJmaWxlUGF0aCIsImdldFBhdGgiLCJnZW5lcmF0ZVVzZXJNZXNzYWdlIiwic2V2ZXJpdHkiLCJleGNlcnB0IiwidGV4dCIsImdldFRleHQiLCJydWxlcyIsImlzTW9kaWZpZWQiLCJpZ25vcmVkUnVsZXMiLCJnZXRGaXhhYmxlUnVsZXMiLCJydWxlSWQiLCJyZXNwb25zZSIsInNlbmRKb2IiLCJ0eXBlIiwiY29udGVudHMiLCJwcm9qZWN0UGF0aCIsInByb2plY3QiLCJyZWxhdGl2aXplUGF0aCIsInByb2Nlc3NKb2JSZXNwb25zZSIsImVycm9yIiwiaGFuZGxlRXJyb3IiLCJpc1NhdmUiLCJtZXNzYWdlIiwiYWRkRXJyb3IiLCJrZXlzIiwiYWRkU3VjY2VzcyIsImVyciIsImFkZFdhcm5pbmciXSwibWFwcGluZ3MiOiI7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7OztBQUpBO0FBTUE7QUFDQSxNQUFNQSxhQUFhLEdBQUcsSUFBSUMsR0FBSixFQUF0Qjs7QUFFQSxNQUFNQyxnQkFBZ0IsR0FBSUMsSUFBRCxJQUFVO0FBQ2pDLE1BQUlDLFVBQUo7O0FBQ0EsUUFBTUMsUUFBUSxHQUFHLE1BQU07QUFDckJMLElBQUFBLGFBQWEsQ0FBQ00sTUFBZCxDQUFxQkYsVUFBckI7QUFDQUQsSUFBQUEsSUFBSTtBQUNMLEdBSEQ7O0FBSUFDLEVBQUFBLFVB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Q0FBakQsRUFBb0Q7QUFDbERvRCxNQUFBQSxLQUFLLEdBQUczRSxzQkFBUjtBQUNEOztBQUVELFFBQUk7QUFDRixZQUFNZ0YsUUFBUSxHQUFHLE1BQU14RixPQUFPLENBQUN5RixPQUFSLENBQWdCO0FBQ3JDQyxRQUFBQSxJQUFJLEVBQUUsS0FEK0I7QUFFckNqRSxRQUFBQSxNQUFNLEVBQUV2QixJQUFJLENBQUN1QixNQUFMLENBQVljLEdBQVosQ0FBZ0IsZUFBaEIsQ0FGNkI7QUFHckNvRCxRQUFBQSxRQUFRLEVBQUVWLElBSDJCO0FBSXJDRSxRQUFBQSxLQUpxQztBQUtyQ1AsUUFBQUEsUUFMcUM7QUFNckNnQixRQUFBQTtBQU5xQyxPQUFoQixDQUF2Qjs7QUFRQSxVQUFJLENBQUNNLE1BQUwsRUFBYTtBQUNYaEcsUUFBQUEsSUFBSSxDQUFDNkMsYUFBTCxDQUFtQnVELFVBQW5CLENBQThCZCxRQUE5QjtBQUNEO0FBQ0YsS0FaRCxDQVlFLE9BQU9lLEdBQVAsRUFBWTtBQUNackcsTUFBQUEsSUFBSSxDQUFDNkMsYUFBTCxDQUFtQnlELFVBQW5CLENBQThCRCxHQUFHLENBQUNKLE9BQWxDO0FBQ0Q7QUFDRjs7QUFyT2MsQ0FBakIiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgaW1wb3J0L25vLWV4dHJhbmVvdXMtZGVwZW5kZW5jaWVzLCBpbXBvcnQvZXh0ZW5zaW9uc1xuaW1wb3J0IHsgQ29tcG9zaXRlRGlzcG9zYWJsZSB9IGZyb20gJ2F0b20nXG5pbXBvcnQgeyBoYXNWYWxpZFNjb3BlIH0gZnJvbSAnLi92YWxpZGF0ZS9lZGl0b3InXG5pbXBvcnQgKiBhcyBoZWxwZXJzIGZyb20gJy4vaGVscGVycydcbmltcG9ydCB7IG1pZ3JhdGVDb25maWdPcHRpb25zIH0gZnJvbSAnLi9taWdyYXRlLWNvbmZpZy1vcHRpb25zJ1xuXG4vLyBJbnRlcm5hbCB2YXJpYWJsZXNcbmNvbnN0IGlkbGVDYWxsYmFja3MgPSBuZXcgU2V0KClcblxuY29uc3QgbWFrZUlkbGVDYWxsYmFjayA9ICh3b3JrKSA9PiB7XG4gIGxldCBjYWxsYmFja0lkXG4gIGNvbnN0IGNhbGxCYWNrID0gKCkgPT4ge1xuICAgIGlkbGVDYWxsYmFja3MuZGVsZXRlKGNhbGxiYWNrSWQpXG4gICAgd29yaygpXG4gIH1cbiAgY2FsbGJhY2tJZCA9IHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxCYWNrKVxuICBpZGxlQ2FsbGJhY2tzLmFkZChjYWxsYmFja0lkKVxufVxuXG5jb25zdCBzY2hlZHVsZUlkbGVUYXNrcyA9ICgpID0+IHtcbiAgY29uc3QgbGludGVyRXNsaW50SW5zdGFsbFBlZXJQYWNrYWdlcyA9ICgpID0+IHtcbiAgICByZXF1aXJlKCdhdG9tLXBhY2thZ2UtZGVwcycpLmluc3RhbGwoJ2xpbnRlci1lc2xpbnQnKVxuICB9XG4gIGNvbnN0IGxpbnRlckVzbGludFN0YXJ0V29ya2VyID0gKCkgPT4ge1xuICAgIGhlbHBlcnMuc3RhcnRXb3JrZXIoKVxuICB9XG5cbiAgaWYgKCFhdG9tLmluU3BlY01vZGUoKSkge1xuICAgIG1ha2VJZGxlQ2FsbGJhY2sobGludGVyRXNsaW50SW5zdGFsbFBlZXJQYWNrYWdlcylcbiAgICBtYWtlSWRsZUNhbGxiYWNrKGxpbnRlckVzbGludFN0YXJ0V29ya2VyKVxuICB9XG59XG5cbi8vIENvbmZpZ3VyYXRpb25cbmNvbnN0IHNjb3BlcyA9IFtdXG5sZXQgc2hvd1J1bGVcbmxldCBsaW50SHRtbEZpbGVzXG5sZXQgaWdub3JlZFJ1bGVzV2hlbk1vZGlmaWVkXG5sZXQgaWdub3JlZFJ1bGVzV2hlbkZpeGluZ1xubGV0IGlnbm9yZUZpeGFibGVSdWxlc1doaWxlVHlwaW5nXG5cbi8vIEludGVybmFsIGZ1bmN0aW9uc1xuLyoqXG4gKiBHaXZlbiBhbiBBcnJheSBvciBpdGVyYWJsZSBjb250YWluaW5nIGEgbGlzdCBvZiBSdWxlIElEcywgcmV0dXJuIGFuIE9iamVjdFxuICogdG8gYmUgc2VudCB0byBFU0xpbnQncyBjb25maWd1cmF0aW9uIHRoYXQgZGlzYWJsZXMgdGhvc2UgcnVsZXMuXG4gKiBAcGFyYW0gIHtbaXRlcmFibGVdfSBydWxlSWRzIEl0ZXJhYmxlIGNvbnRhaW5pbmcgcnVsZUlkcyB0byBpZ25vcmVcbiAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgICAgT2JqZWN0IGNvbnRhaW5pbmcgcHJvcGVydGllcyBmb3IgZWFjaCBydWxlIHRvIGlnbm9yZVxuICovXG5jb25zdCBpZHNUb0lnbm9yZWRSdWxlcyA9IChydWxlSWRzKSA9PiAoXG4gIEFycmF5LmZyb20ocnVsZUlkcykucmVkdWNlKFxuICAgIC8vIDAgaXMgdGhlIHNldmVyaXR5IHRvIHR1cm4gb2ZmIGEgcnVsZVxuICAgIChpZHMsIGlkKSA9PiBPYmplY3QuYXNzaWduKGlkcywgeyBbaWRdOiAwIH0pLFxuICAgIHt9XG4gICkpXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBhY3RpdmF0ZSgpIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpXG5cbiAgICBtaWdyYXRlQ29uZmlnT3B0aW9ucygpXG5cbiAgICBjb25zdCBlbWJlZGRlZFNjb3BlID0gJ3NvdXJjZS5qcy5lbWJlZGRlZC5odG1sJ1xuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZShcbiAgICAgICdsaW50ZXItZXNsaW50LmxpbnRIdG1sRmlsZXMnLFxuICAgICAgKHZhbHVlKSA9PiB7XG4gICAgICAgIGxpbnRIdG1sRmlsZXMgPSB2YWx1ZVxuICAgICAgICBpZiAobGludEh0bWxGaWxlcykge1xuICAgICAgICAgIHNjb3Blcy5wdXNoKGVtYmVkZGVkU2NvcGUpXG4gICAgICAgIH0gZWxzZSBpZiAoc2NvcGVzLmluZGV4T2YoZW1iZWRkZWRTY29wZSkgIT09IC0xKSB7XG4gICAgICAgICAgc2NvcGVzLnNwbGljZShzY29wZXMuaW5kZXhPZihlbWJlZGRlZFNjb3BlKSwgMSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICkpXG5cbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoXG4gICAgICAnbGludGVyLWVzbGludC5zY29wZXMnLFxuICAgICAgKHZhbHVlKSA9PiB7XG4gICAgICAgIC8vIFJlbW92ZSBhbnkgb2xkIHNjb3Blc1xuICAgICAgICBzY29wZXMuc3BsaWNlKDAsIHNjb3Blcy5sZW5ndGgpXG4gICAgICAgIC8vIEFkZCB0aGUgY3VycmVudCBzY29wZXNcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkoc2NvcGVzLCB2YWx1ZSlcbiAgICAgICAgLy8gRW5zdXJlIEhUTUwgbGludGluZyBzdGlsbCB3b3JrcyBpZiB0aGUgc2V0dGluZyBpcyB1cGRhdGVkXG4gICAgICAgIGlmIChsaW50SHRtbEZpbGVzICYmICFzY29wZXMuaW5jbHVkZXMoZW1iZWRkZWRTY29wZSkpIHtcbiAgICAgICAgICBzY29wZXMucHVzaChlbWJlZGRlZFNjb3BlKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgKSlcblxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoYXRvbS53b3Jrc3BhY2Uub2JzZXJ2ZVRleHRFZGl0b3JzKChlZGl0b3IpID0+IHtcbiAgICAgIGVkaXRvci5vbkRpZFNhdmUoYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoaGFzVmFsaWRTY29wZShlZGl0b3IsIHNjb3BlcylcbiAgICAgICAgICAmJiBhdG9tLmNvbmZpZy5nZXQoJ2xpbnRlci1lc2xpbnQuYXV0b2ZpeC5maXhPblNhdmUnKVxuICAgICAgICApIHtcbiAgICAgICAgICBhd2FpdCB0aGlzLmZpeEpvYih0cnVlKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0pKVxuXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvcicsIHtcbiAgICAgICdsaW50ZXItZXNsaW50OmRlYnVnJzogYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBkZWJ1Z1N0cmluZyA9IGF3YWl0IGhlbHBlcnMuZ2VuZXJhdGVEZWJ1Z1N0cmluZygpXG4gICAgICAgIGNvbnN0IG5vdGlmaWNhdGlvbk9wdGlvbnMgPSB7IGRldGFpbDogZGVidWdTdHJpbmcsIGRpc21pc3NhYmxlOiB0cnVlIH1cbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEluZm8oJ2xpbnRlci1lc2xpbnQgZGVidWdnaW5nIGluZm9ybWF0aW9uJywgbm90aWZpY2F0aW9uT3B0aW9ucylcbiAgICAgIH1cbiAgICB9KSlcblxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20tdGV4dC1lZGl0b3InLCB7XG4gICAgICAnbGludGVyLWVzbGludDpmaXgtZmlsZSc6IGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5maXhKb2IoKVxuICAgICAgfVxuICAgIH0pKVxuXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKFxuICAgICAgJ2xpbnRlci1lc2xpbnQuYWR2YW5jZWQuc2hvd1J1bGVJZEluTWVzc2FnZScsXG4gICAgICAodmFsdWUpID0+IHsgc2hvd1J1bGUgPSB2YWx1ZSB9XG4gICAgKSlcblxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZShcbiAgICAgICdsaW50ZXItZXNsaW50LmRpc2FibGluZy5ydWxlc1RvU2lsZW5jZVdoaWxlVHlwaW5nJyxcbiAgICAgIChpZHMpID0+IHsgaWdub3JlZFJ1bGVzV2hlbk1vZGlmaWVkID0gaWRzIH1cbiAgICApKVxuXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKFxuICAgICAgJ2xpbnRlci1lc2xpbnQuYXV0b2ZpeC5ydWxlc1RvRGlzYWJsZVdoaWxlRml4aW5nJyxcbiAgICAgIChpZHMpID0+IHsgaWdub3JlZFJ1bGVzV2hlbkZpeGluZyA9IGlkc1RvSWdub3JlZFJ1bGVzKGlkcykgfVxuICAgICkpXG5cbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoXG4gICAgICAnbGludGVyLWVzbGludC5hdXRvZml4Lmlnbm9yZUZpeGFibGVSdWxlc1doaWxlVHlwaW5nJyxcbiAgICAgICh2YWx1ZSkgPT4geyBpZ25vcmVGaXhhYmxlUnVsZXNXaGlsZVR5cGluZyA9IHZhbHVlIH1cbiAgICApKVxuXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChhdG9tLmNvbnRleHRNZW51LmFkZCh7XG4gICAgICAnYXRvbS10ZXh0LWVkaXRvcjpub3QoLm1pbmkpLCAub3ZlcmxheWVyJzogW3tcbiAgICAgICAgbGFiZWw6ICdFU0xpbnQgRml4JyxcbiAgICAgICAgY29tbWFuZDogJ2xpbnRlci1lc2xpbnQ6Zml4LWZpbGUnLFxuICAgICAgICBzaG91bGREaXNwbGF5OiAoZXZ0KSA9PiB7XG4gICAgICAgICAgY29uc3QgYWN0aXZlRWRpdG9yID0gYXRvbS53b3Jrc3BhY2UuZ2V0QWN0aXZlVGV4dEVkaXRvcigpXG4gICAgICAgICAgaWYgKCFhY3RpdmVFZGl0b3IpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBCbGFjayBtYWdpYyFcbiAgICAgICAgICAvLyBDb21wYXJlcyB0aGUgcHJpdmF0ZSBjb21wb25lbnQgcHJvcGVydHkgb2YgdGhlIGFjdGl2ZSBUZXh0RWRpdG9yXG4gICAgICAgICAgLy8gICBhZ2FpbnN0IHRoZSBjb21wb25lbnRzIG9mIHRoZSBlbGVtZW50c1xuICAgICAgICAgIGNvbnN0IGV2dElzQWN0aXZlRWRpdG9yID0gZXZ0LnBhdGguc29tZSgoZWxlbSkgPT4gKFxuICAgICAgICAgICAgLy8gQXRvbSB2MS4xOS4wK1xuICAgICAgICAgICAgZWxlbS5jb21wb25lbnQgJiYgYWN0aXZlRWRpdG9yLmNvbXBvbmVudFxuICAgICAgICAgICAgICAmJiBlbGVtLmNvbXBvbmVudCA9PT0gYWN0aXZlRWRpdG9yLmNvbXBvbmVudCkpXG4gICAgICAgICAgLy8gT25seSBzaG93IGlmIGl0IHdhcyB0aGUgYWN0aXZlIGVkaXRvciBhbmQgaXQgaXMgYSB2YWxpZCBzY29wZVxuICAgICAgICAgIHJldHVybiBldnRJc0FjdGl2ZUVkaXRvciAmJiBoYXNWYWxpZFNjb3BlKGFjdGl2ZUVkaXRvciwgc2NvcGVzKVxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH0pKVxuXG4gICAgc2NoZWR1bGVJZGxlVGFza3MoKVxuICB9LFxuXG4gIGRlYWN0aXZhdGUoKSB7XG4gICAgaWRsZUNhbGxiYWNrcy5mb3JFYWNoKChjYWxsYmFja0lEKSA9PiB3aW5kb3cuY2FuY2VsSWRsZUNhbGxiYWNrKGNhbGxiYWNrSUQpKVxuICAgIGlkbGVDYWxsYmFja3MuY2xlYXIoKVxuICAgIGlmIChoZWxwZXJzKSB7XG4gICAgICAvLyBJZiB0aGUgaGVscGVycyBtb2R1bGUgaGFzbid0IGJlZW4gbG9hZGVkIHRoZW4gdGhlcmUgd2FzIG5vIGNoYW5jZSBhXG4gICAgICAvLyB3b3JrZXIgd2FzIHN0YXJ0ZWQgYW55d2F5LlxuICAgICAgaGVscGVycy5raWxsV29ya2VyKClcbiAgICB9XG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmRpc3Bvc2UoKVxuICB9LFxuXG4gIHByb3ZpZGVMaW50ZXIoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6ICdFU0xpbnQnLFxuICAgICAgZ3JhbW1hclNjb3Blczogc2NvcGVzLFxuICAgICAgc2NvcGU6ICdmaWxlJyxcbiAgICAgIGxpbnRzT25DaGFuZ2U6IHRydWUsXG4gICAgICAvKipcbiAgICAgICAqIEBwYXJhbSB7aW1wb3J0KFwiYXRvbVwiKS5UZXh0RWRpdG9yfSB0ZXh0RWRpdG9yXG4gICAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxpbXBvcnQoXCJhdG9tL2xpbnRlclwiKS5NZXNzYWdlW10+fVxuICAgICAgICovXG4gICAgICBsaW50OiBhc3luYyAodGV4dEVkaXRvcikgPT4ge1xuICAgICAgICBpZiAoIWF0b20ud29ya3NwYWNlLmlzVGV4dEVkaXRvcih0ZXh0RWRpdG9yKSkge1xuICAgICAgICAgIC8vIElmIHdlIHNvbWVob3cgZ2V0IGZlZCBhbiBpbnZhbGlkIFRleHRFZGl0b3IganVzdCBpbW1lZGlhdGVseSByZXR1cm5cbiAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZmlsZVBhdGggPSB0ZXh0RWRpdG9yLmdldFBhdGgoKVxuICAgICAgICBpZiAoIWZpbGVQYXRoKSB7XG4gICAgICAgICAgLy8gVGhlIGVkaXRvciBjdXJyZW50bHkgaGFzIG5vIHBhdGgsIHdlIGNhbid0IHJlcG9ydCBtZXNzYWdlcyBiYWNrIHRvXG4gICAgICAgICAgLy8gTGludGVyIHNvIGp1c3QgcmV0dXJuIG51bGxcbiAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZpbGVQYXRoLmluY2x1ZGVzKCc6Ly8nKSkge1xuICAgICAgICAgIC8vIElmIHRoZSBwYXRoIGlzIGEgVVJMIChOdWNsaWRlIHJlbW90ZSBmaWxlKSByZXR1cm4gYSBtZXNzYWdlXG4gICAgICAgICAgLy8gdGVsbGluZyB0aGUgdXNlciB3ZSBhcmUgdW5hYmxlIHRvIHdvcmsgb24gcmVtb3RlIGZpbGVzLlxuICAgICAgICAgIHJldHVybiBoZWxwZXJzLmdlbmVyYXRlVXNlck1lc3NhZ2UodGV4dEVkaXRvciwge1xuICAgICAgICAgICAgc2V2ZXJpdHk6ICd3YXJuaW5nJyxcbiAgICAgICAgICAgIGV4Y2VycHQ6ICdSZW1vdGUgZmlsZSBvcGVuLCBsaW50ZXItZXNsaW50IGlzIGRpc2FibGVkIGZvciB0aGlzIGZpbGUuJyxcbiAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGV4dCA9IHRleHRFZGl0b3IuZ2V0VGV4dCgpXG5cbiAgICAgICAgbGV0IHJ1bGVzID0ge31cbiAgICAgICAgaWYgKHRleHRFZGl0b3IuaXNNb2RpZmllZCgpKSB7XG4gICAgICAgICAgaWYgKGlnbm9yZUZpeGFibGVSdWxlc1doaWxlVHlwaW5nKSB7XG4gICAgICAgICAgICAvLyBOb3RlIHRoYXQgdGhlIGZpeGFibGUgcnVsZXMgd2lsbCBvbmx5IGhhdmUgdmFsdWVzIGFmdGVyIHRoZSBmaXJzdCBsaW50IGpvYlxuICAgICAgICAgICAgY29uc3QgaWdub3JlZFJ1bGVzID0gbmV3IFNldChoZWxwZXJzLnJ1bGVzLmdldEZpeGFibGVSdWxlcygpKVxuICAgICAgICAgICAgaWdub3JlZFJ1bGVzV2hlbk1vZGlmaWVkLmZvckVhY2goKHJ1bGVJZCkgPT4gaWdub3JlZFJ1bGVzLmFkZChydWxlSWQpKVxuICAgICAgICAgICAgcnVsZXMgPSBpZHNUb0lnbm9yZWRSdWxlcyhpZ25vcmVkUnVsZXMpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJ1bGVzID0gaWRzVG9JZ25vcmVkUnVsZXMoaWdub3JlZFJ1bGVzV2hlbk1vZGlmaWVkKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBoZWxwZXJzLnNlbmRKb2Ioe1xuICAgICAgICAgICAgdHlwZTogJ2xpbnQnLFxuICAgICAgICAgICAgY29udGVudHM6IHRleHQsXG4gICAgICAgICAgICBjb25maWc6IGF0b20uY29uZmlnLmdldCgnbGludGVyLWVzbGludCcpLFxuICAgICAgICAgICAgcnVsZXMsXG4gICAgICAgICAgICBmaWxlUGF0aCxcbiAgICAgICAgICAgIHByb2plY3RQYXRoOiBhdG9tLnByb2plY3QucmVsYXRpdml6ZVBhdGgoZmlsZVBhdGgpWzBdIHx8ICcnXG4gICAgICAgICAgfSlcbiAgICAgICAgICBpZiAodGV4dEVkaXRvci5nZXRUZXh0KCkgIT09IHRleHQpIHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICBUaGUgZWRpdG9yIHRleHQgaGFzIGJlZW4gbW9kaWZpZWQgc2luY2UgdGhlIGxpbnQgd2FzIHRyaWdnZXJlZCxcbiAgICAgICAgICAgIGFzIHdlIGNhbid0IGJlIHN1cmUgdGhhdCB0aGUgcmVzdWx0cyB3aWxsIG1hcCBwcm9wZXJseSBiYWNrIHRvXG4gICAgICAgICAgICB0aGUgbmV3IGNvbnRlbnRzLCBzaW1wbHkgcmV0dXJuIGBudWxsYCB0byB0ZWxsIHRoZVxuICAgICAgICAgICAgYHByb3ZpZGVMaW50ZXJgIGNvbnN1bWVyIG5vdCB0byB1cGRhdGUgdGhlIHNhdmVkIHJlc3VsdHMuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGhlbHBlcnMucHJvY2Vzc0pvYlJlc3BvbnNlKHJlc3BvbnNlLCB0ZXh0RWRpdG9yLCBzaG93UnVsZSlcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gaGVscGVycy5oYW5kbGVFcnJvcih0ZXh0RWRpdG9yLCBlcnJvcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBhc3luYyBmaXhKb2IoaXNTYXZlID0gZmFsc2UpIHtcbiAgICBjb25zdCB0ZXh0RWRpdG9yID0gYXRvbS53b3Jrc3BhY2UuZ2V0QWN0aXZlVGV4dEVkaXRvcigpXG5cbiAgICBpZiAoIXRleHRFZGl0b3IgfHwgIWF0b20ud29ya3NwYWNlLmlzVGV4dEVkaXRvcih0ZXh0RWRpdG9yKSkge1xuICAgICAgLy8gU2lsZW50bHkgcmV0dXJuIGlmIHRoZSBUZXh0RWRpdG9yIGlzIGludmFsaWRcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmICh0ZXh0RWRpdG9yLmlzTW9kaWZpZWQoKSkge1xuICAgICAgLy8gQWJvcnQgZm9yIGludmFsaWQgb3IgdW5zYXZlZCB0ZXh0IGVkaXRvcnNcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSAnTGludGVyLUVTTGludDogUGxlYXNlIHNhdmUgYmVmb3JlIGZpeGluZydcbiAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRFcnJvcihtZXNzYWdlKVxuICAgIH1cblxuICAgIGNvbnN0IGZpbGVQYXRoID0gdGV4dEVkaXRvci5nZXRQYXRoKClcbiAgICBjb25zdCBwcm9qZWN0UGF0aCA9IGF0b20ucHJvamVjdC5yZWxhdGl2aXplUGF0aChmaWxlUGF0aClbMF1cblxuICAgIC8vIEdldCB0aGUgdGV4dCBmcm9tIHRoZSBlZGl0b3IsIHNvIHdlIGNhbiB1c2UgZXhlY3V0ZU9uVGV4dFxuICAgIGNvbnN0IHRleHQgPSB0ZXh0RWRpdG9yLmdldFRleHQoKVxuICAgIC8vIERvIG5vdCB0cnkgdG8gbWFrZSBmaXhlcyBvbiBhbiBlbXB0eSBmaWxlXG4gICAgaWYgKHRleHQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBsZXQgcnVsZXMgPSB7fVxuICAgIGlmIChPYmplY3Qua2V5cyhpZ25vcmVkUnVsZXNXaGVuRml4aW5nKS5sZW5ndGggPiAwKSB7XG4gICAgICBydWxlcyA9IGlnbm9yZWRSdWxlc1doZW5GaXhpbmdcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBoZWxwZXJzLnNlbmRKb2Ioe1xuICAgICAgICB0eXBlOiAnZml4JyxcbiAgICAgICAgY29uZmlnOiBhdG9tLmNvbmZpZy5nZXQoJ2xpbnRlci1lc2xpbnQnKSxcbiAgICAgICAgY29udGVudHM6IHRleHQsXG4gICAgICAgIHJ1bGVzLFxuICAgICAgICBmaWxlUGF0aCxcbiAgICAgICAgcHJvamVjdFBhdGhcbiAgICAgIH0pXG4gICAgICBpZiAoIWlzU2F2ZSkge1xuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkU3VjY2VzcyhyZXNwb25zZSlcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRXYXJuaW5nKGVyci5tZXNzYWdlKVxuICAgIH1cbiAgfSxcbn1cbiJdfQ==