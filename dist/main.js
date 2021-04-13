"use strict";

var _atom = require("atom");

var _editor = require("./validate/editor");

var helpers = _interopRequireWildcard(require("./helpers"));

var _migrateConfigOptions = require("./migrate-config-options");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9tYWluLmpzIl0sIm5hbWVzIjpbImlkbGVDYWxsYmFja3MiLCJTZXQiLCJtYWtlSWRsZUNhbGxiYWNrIiwid29yayIsImNhbGxiYWNrSWQiLCJjYWxsQmFjayIsImRlbGV0ZSIsIndpbmRvdyIsInJlcXVlc3RJZGxlQ2FsbGJhY2siLCJhZGQiLCJzY2hlZHVsZUlkbGVUYXNrcyIsImxpbnRlckVzbGludEluc3RhbGxQZWVyUGFja2FnZXMiLCJyZXF1aXJlIiwiaW5zdGFsbCIsImxpbnRlckVzbGludFN0YXJ0V29ya2VyIiwiaGVscGVycyIsInN0YXJ0V29ya2VyIiwiYXRvbSIsImluU3BlY01vZGUiLCJzY29wZXMiLCJzaG93UnVsZSIsImxpbnRIdG1sRmlsZXMiLCJpZ25vcmVkUnVsZXNXaGVuTW9kaWZpZWQiLCJpZ25vcmVkUnVsZXNXaGVuRml4aW5nIiwiaWdub3JlRml4YWJsZVJ1bGVzV2hpbGVUeXBpbmciLCJpZHNUb0lnbm9yZWRSdWxlcyIsInJ1bGVJZHMiLCJBcnJheSIsImZyb20iLCJyZWR1Y2UiLCJpZHMiLCJpZCIsIk9iamVjdCIsImFzc2lnbiIsIm1vZHVsZSIsImV4cG9ydHMiLCJhY3RpdmF0ZSIsInN1YnNjcmlwdGlvbnMiLCJDb21wb3NpdGVEaXNwb3NhYmxlIiwiZW1iZWRkZWRTY29wZSIsImNvbmZpZyIsIm9ic2VydmUiLCJ2YWx1ZSIsInB1c2giLCJpbmRleE9mIiwic3BsaWNlIiwibGVuZ3RoIiwicHJvdG90eXBlIiwiYXBwbHkiLCJpbmNsdWRlcyIsIndvcmtzcGFjZSIsIm9ic2VydmVUZXh0RWRpdG9ycyIsImVkaXRvciIsIm9uRGlkU2F2ZSIsImdldCIsImZpeEpvYiIsImNvbW1hbmRzIiwiZGVidWdTdHJpbmciLCJnZW5lcmF0ZURlYnVnU3RyaW5nIiwibm90aWZpY2F0aW9uT3B0aW9ucyIsImRldGFpbCIsImRpc21pc3NhYmxlIiwibm90aWZpY2F0aW9ucyIsImFkZEluZm8iLCJjb250ZXh0TWVudSIsImxhYmVsIiwiY29tbWFuZCIsInNob3VsZERpc3BsYXkiLCJldnQiLCJhY3RpdmVFZGl0b3IiLCJnZXRBY3RpdmVUZXh0RWRpdG9yIiwiZXZ0SXNBY3RpdmVFZGl0b3IiLCJwYXRoIiwic29tZSIsImVsZW0iLCJjb21wb25lbnQiLCJkZWFjdGl2YXRlIiwiZm9yRWFjaCIsImNhbGxiYWNrSUQiLCJjYW5jZWxJZGxlQ2FsbGJhY2siLCJjbGVhciIsImtpbGxXb3JrZXIiLCJkaXNwb3NlIiwicHJvdmlkZUxpbnRlciIsIm5hbWUiLCJncmFtbWFyU2NvcGVzIiwic2NvcGUiLCJsaW50c09uQ2hhbmdlIiwibGludCIsInRleHRFZGl0b3IiLCJpc1RleHRFZGl0b3IiLCJmaWxlUGF0aCIsImdldFBhdGgiLCJnZW5lcmF0ZVVzZXJNZXNzYWdlIiwic2V2ZXJpdHkiLCJleGNlcnB0IiwidGV4dCIsImdldFRleHQiLCJydWxlcyIsImlzTW9kaWZpZWQiLCJpZ25vcmVkUnVsZXMiLCJnZXRGaXhhYmxlUnVsZXMiLCJydWxlSWQiLCJyZXNwb25zZSIsInNlbmRKb2IiLCJ0eXBlIiwiY29udGVudHMiLCJwcm9qZWN0UGF0aCIsInByb2plY3QiLCJyZWxhdGl2aXplUGF0aCIsInByb2Nlc3NKb2JSZXNwb25zZSIsImVycm9yIiwiaGFuZGxlRXJyb3IiLCJpc1NhdmUiLCJtZXNzYWdlIiwiYWRkRXJyb3IiLCJrZXlzIiwiYWRkU3VjY2VzcyIsImVyciIsImFkZFdhcm5pbmciXSwibWFwcGluZ3MiOiI7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7OztBQUpBO0FBTUE7QUFDQSxNQUFNQSxhQUFhLEdBQUcsSUFBSUMsR0FBSixFQUF0Qjs7QUFFQSxNQUFNQyxnQkFBZ0IsR0FBSUMsSUFBRCxJQUFVO0FBQ2pDLE1BQUlDLFVBQUo7O0FBQ0EsUUFBTUMsUUFBUSxHQUFHLE1BQU07QUFDckJMLElBQUFBLGFBQWEsQ0FBQ00sTUFBZCxDQUFxQkYsVUFBckI7QUFDQUQsSUFBQUEsSUFBSTtBQUNMLEdBSEQ7O0FBSUFDLEVBQUFBLFVB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QUFqRCxFQUFvRDtBQUNsRG9ELE1BQUFBLEtBQUssR0FBRzNFLHNCQUFSO0FBQ0Q7O0FBRUQsUUFBSTtBQUNGLFlBQU1nRixRQUFRLEdBQUcsTUFBTXhGLE9BQU8sQ0FBQ3lGLE9BQVIsQ0FBZ0I7QUFDckNDLFFBQUFBLElBQUksRUFBRSxLQUQrQjtBQUVyQ2pFLFFBQUFBLE1BQU0sRUFBRXZCLElBQUksQ0FBQ3VCLE1BQUwsQ0FBWWMsR0FBWixDQUFnQixlQUFoQixDQUY2QjtBQUdyQ29ELFFBQUFBLFFBQVEsRUFBRVYsSUFIMkI7QUFJckNFLFFBQUFBLEtBSnFDO0FBS3JDUCxRQUFBQSxRQUxxQztBQU1yQ2dCLFFBQUFBO0FBTnFDLE9BQWhCLENBQXZCOztBQVFBLFVBQUksQ0FBQ00sTUFBTCxFQUFhO0FBQ1hoRyxRQUFBQSxJQUFJLENBQUM2QyxhQUFMLENBQW1CdUQsVUFBbkIsQ0FBOEJkLFFBQTlCO0FBQ0Q7QUFDRixLQVpELENBWUUsT0FBT2UsR0FBUCxFQUFZO0FBQ1pyRyxNQUFBQSxJQUFJLENBQUM2QyxhQUFMLENBQW1CeUQsVUFBbkIsQ0FBOEJELEdBQUcsQ0FBQ0osT0FBbEM7QUFDRDtBQUNGOztBQXRPYyxDQUFqQiIsInNvdXJjZXNDb250ZW50IjpbIi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXMsIGltcG9ydC9leHRlbnNpb25zXG5pbXBvcnQgeyBDb21wb3NpdGVEaXNwb3NhYmxlIH0gZnJvbSAnYXRvbSdcbmltcG9ydCB7IGhhc1ZhbGlkU2NvcGUgfSBmcm9tICcuL3ZhbGlkYXRlL2VkaXRvcidcbmltcG9ydCAqIGFzIGhlbHBlcnMgZnJvbSAnLi9oZWxwZXJzJ1xuaW1wb3J0IHsgbWlncmF0ZUNvbmZpZ09wdGlvbnMgfSBmcm9tICcuL21pZ3JhdGUtY29uZmlnLW9wdGlvbnMnXG5cbi8vIEludGVybmFsIHZhcmlhYmxlc1xuY29uc3QgaWRsZUNhbGxiYWNrcyA9IG5ldyBTZXQoKVxuXG5jb25zdCBtYWtlSWRsZUNhbGxiYWNrID0gKHdvcmspID0+IHtcbiAgbGV0IGNhbGxiYWNrSWRcbiAgY29uc3QgY2FsbEJhY2sgPSAoKSA9PiB7XG4gICAgaWRsZUNhbGxiYWNrcy5kZWxldGUoY2FsbGJhY2tJZClcbiAgICB3b3JrKClcbiAgfVxuICBjYWxsYmFja0lkID0gd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbEJhY2spXG4gIGlkbGVDYWxsYmFja3MuYWRkKGNhbGxiYWNrSWQpXG59XG5cbmNvbnN0IHNjaGVkdWxlSWRsZVRhc2tzID0gKCkgPT4ge1xuICBjb25zdCBsaW50ZXJFc2xpbnRJbnN0YWxsUGVlclBhY2thZ2VzID0gKCkgPT4ge1xuICAgIHJlcXVpcmUoJ2F0b20tcGFja2FnZS1kZXBzJykuaW5zdGFsbCgnbGludGVyLWVzbGludCcpXG4gIH1cbiAgY29uc3QgbGludGVyRXNsaW50U3RhcnRXb3JrZXIgPSAoKSA9PiB7XG4gICAgaGVscGVycy5zdGFydFdvcmtlcigpXG4gIH1cblxuICBpZiAoIWF0b20uaW5TcGVjTW9kZSgpKSB7XG4gICAgbWFrZUlkbGVDYWxsYmFjayhsaW50ZXJFc2xpbnRJbnN0YWxsUGVlclBhY2thZ2VzKVxuICAgIG1ha2VJZGxlQ2FsbGJhY2sobGludGVyRXNsaW50U3RhcnRXb3JrZXIpXG4gIH1cbn1cblxuLy8gQ29uZmlndXJhdGlvblxuY29uc3Qgc2NvcGVzID0gW11cbmxldCBzaG93UnVsZVxubGV0IGxpbnRIdG1sRmlsZXNcbmxldCBpZ25vcmVkUnVsZXNXaGVuTW9kaWZpZWRcbmxldCBpZ25vcmVkUnVsZXNXaGVuRml4aW5nXG5sZXQgaWdub3JlRml4YWJsZVJ1bGVzV2hpbGVUeXBpbmdcblxuLy8gSW50ZXJuYWwgZnVuY3Rpb25zXG4vKipcbiAqIEdpdmVuIGFuIEFycmF5IG9yIGl0ZXJhYmxlIGNvbnRhaW5pbmcgYSBsaXN0IG9mIFJ1bGUgSURzLCByZXR1cm4gYW4gT2JqZWN0XG4gKiB0byBiZSBzZW50IHRvIEVTTGludCdzIGNvbmZpZ3VyYXRpb24gdGhhdCBkaXNhYmxlcyB0aG9zZSBydWxlcy5cbiAqIEBwYXJhbSAge1tpdGVyYWJsZV19IHJ1bGVJZHMgSXRlcmFibGUgY29udGFpbmluZyBydWxlSWRzIHRvIGlnbm9yZVxuICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgICBPYmplY3QgY29udGFpbmluZyBwcm9wZXJ0aWVzIGZvciBlYWNoIHJ1bGUgdG8gaWdub3JlXG4gKi9cbmNvbnN0IGlkc1RvSWdub3JlZFJ1bGVzID0gcnVsZUlkcyA9PiAoXG4gIEFycmF5LmZyb20ocnVsZUlkcykucmVkdWNlKFxuICAgIC8vIDAgaXMgdGhlIHNldmVyaXR5IHRvIHR1cm4gb2ZmIGEgcnVsZVxuICAgIChpZHMsIGlkKSA9PiBPYmplY3QuYXNzaWduKGlkcywgeyBbaWRdOiAwIH0pLFxuICAgIHt9XG4gICkpXG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFjdGl2YXRlKCkge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9ucyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKClcblxuICAgIG1pZ3JhdGVDb25maWdPcHRpb25zKClcblxuICAgIGNvbnN0IGVtYmVkZGVkU2NvcGUgPSAnc291cmNlLmpzLmVtYmVkZGVkLmh0bWwnXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKFxuICAgICAgJ2xpbnRlci1lc2xpbnQubGludEh0bWxGaWxlcycsXG4gICAgICAodmFsdWUpID0+IHtcbiAgICAgICAgbGludEh0bWxGaWxlcyA9IHZhbHVlXG4gICAgICAgIGlmIChsaW50SHRtbEZpbGVzKSB7XG4gICAgICAgICAgc2NvcGVzLnB1c2goZW1iZWRkZWRTY29wZSlcbiAgICAgICAgfSBlbHNlIGlmIChzY29wZXMuaW5kZXhPZihlbWJlZGRlZFNjb3BlKSAhPT0gLTEpIHtcbiAgICAgICAgICBzY29wZXMuc3BsaWNlKHNjb3Blcy5pbmRleE9mKGVtYmVkZGVkU2NvcGUpLCAxKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgKSlcblxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZShcbiAgICAgICdsaW50ZXItZXNsaW50LnNjb3BlcycsXG4gICAgICAodmFsdWUpID0+IHtcbiAgICAgICAgLy8gUmVtb3ZlIGFueSBvbGQgc2NvcGVzXG4gICAgICAgIHNjb3Blcy5zcGxpY2UoMCwgc2NvcGVzLmxlbmd0aClcbiAgICAgICAgLy8gQWRkIHRoZSBjdXJyZW50IHNjb3Blc1xuICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShzY29wZXMsIHZhbHVlKVxuICAgICAgICAvLyBFbnN1cmUgSFRNTCBsaW50aW5nIHN0aWxsIHdvcmtzIGlmIHRoZSBzZXR0aW5nIGlzIHVwZGF0ZWRcbiAgICAgICAgaWYgKGxpbnRIdG1sRmlsZXMgJiYgIXNjb3Blcy5pbmNsdWRlcyhlbWJlZGRlZFNjb3BlKSkge1xuICAgICAgICAgIHNjb3Blcy5wdXNoKGVtYmVkZGVkU2NvcGUpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApKVxuXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChhdG9tLndvcmtzcGFjZS5vYnNlcnZlVGV4dEVkaXRvcnMoKGVkaXRvcikgPT4ge1xuICAgICAgZWRpdG9yLm9uRGlkU2F2ZShhc3luYyAoKSA9PiB7XG4gICAgICAgIGlmIChoYXNWYWxpZFNjb3BlKGVkaXRvciwgc2NvcGVzKVxuICAgICAgICAgICYmIGF0b20uY29uZmlnLmdldCgnbGludGVyLWVzbGludC5hdXRvZml4LmZpeE9uU2F2ZScpXG4gICAgICAgICkge1xuICAgICAgICAgIGF3YWl0IHRoaXMuZml4Sm9iKHRydWUpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSkpXG5cbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXRleHQtZWRpdG9yJywge1xuICAgICAgJ2xpbnRlci1lc2xpbnQ6ZGVidWcnOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGRlYnVnU3RyaW5nID0gYXdhaXQgaGVscGVycy5nZW5lcmF0ZURlYnVnU3RyaW5nKClcbiAgICAgICAgY29uc3Qgbm90aWZpY2F0aW9uT3B0aW9ucyA9IHsgZGV0YWlsOiBkZWJ1Z1N0cmluZywgZGlzbWlzc2FibGU6IHRydWUgfVxuICAgICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkSW5mbygnbGludGVyLWVzbGludCBkZWJ1Z2dpbmcgaW5mb3JtYXRpb24nLCBub3RpZmljYXRpb25PcHRpb25zKVxuICAgICAgfVxuICAgIH0pKVxuXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS10ZXh0LWVkaXRvcicsIHtcbiAgICAgICdsaW50ZXItZXNsaW50OmZpeC1maWxlJzogYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmZpeEpvYigpXG4gICAgICB9XG4gICAgfSkpXG5cbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoXG4gICAgICAnbGludGVyLWVzbGludC5hZHZhbmNlZC5zaG93UnVsZUlkSW5NZXNzYWdlJyxcbiAgICAgICh2YWx1ZSkgPT4geyBzaG93UnVsZSA9IHZhbHVlIH1cbiAgICApKVxuXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChhdG9tLmNvbmZpZy5vYnNlcnZlKFxuICAgICAgJ2xpbnRlci1lc2xpbnQuZGlzYWJsaW5nLnJ1bGVzVG9TaWxlbmNlV2hpbGVUeXBpbmcnLFxuICAgICAgKGlkcykgPT4geyBpZ25vcmVkUnVsZXNXaGVuTW9kaWZpZWQgPSBpZHMgfVxuICAgICkpXG5cbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGF0b20uY29uZmlnLm9ic2VydmUoXG4gICAgICAnbGludGVyLWVzbGludC5hdXRvZml4LnJ1bGVzVG9EaXNhYmxlV2hpbGVGaXhpbmcnLFxuICAgICAgKGlkcykgPT4geyBpZ25vcmVkUnVsZXNXaGVuRml4aW5nID0gaWRzVG9JZ25vcmVkUnVsZXMoaWRzKSB9XG4gICAgKSlcblxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoYXRvbS5jb25maWcub2JzZXJ2ZShcbiAgICAgICdsaW50ZXItZXNsaW50LmF1dG9maXguaWdub3JlRml4YWJsZVJ1bGVzV2hpbGVUeXBpbmcnLFxuICAgICAgKHZhbHVlKSA9PiB7IGlnbm9yZUZpeGFibGVSdWxlc1doaWxlVHlwaW5nID0gdmFsdWUgfVxuICAgICkpXG5cbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGF0b20uY29udGV4dE1lbnUuYWRkKHtcbiAgICAgICdhdG9tLXRleHQtZWRpdG9yOm5vdCgubWluaSksIC5vdmVybGF5ZXInOiBbe1xuICAgICAgICBsYWJlbDogJ0VTTGludCBGaXgnLFxuICAgICAgICBjb21tYW5kOiAnbGludGVyLWVzbGludDpmaXgtZmlsZScsXG4gICAgICAgIHNob3VsZERpc3BsYXk6IChldnQpID0+IHtcbiAgICAgICAgICBjb25zdCBhY3RpdmVFZGl0b3IgPSBhdG9tLndvcmtzcGFjZS5nZXRBY3RpdmVUZXh0RWRpdG9yKClcbiAgICAgICAgICBpZiAoIWFjdGl2ZUVkaXRvcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIEJsYWNrIG1hZ2ljIVxuICAgICAgICAgIC8vIENvbXBhcmVzIHRoZSBwcml2YXRlIGNvbXBvbmVudCBwcm9wZXJ0eSBvZiB0aGUgYWN0aXZlIFRleHRFZGl0b3JcbiAgICAgICAgICAvLyAgIGFnYWluc3QgdGhlIGNvbXBvbmVudHMgb2YgdGhlIGVsZW1lbnRzXG4gICAgICAgICAgY29uc3QgZXZ0SXNBY3RpdmVFZGl0b3IgPSBldnQucGF0aC5zb21lKGVsZW0gPT4gKFxuICAgICAgICAgICAgLy8gQXRvbSB2MS4xOS4wK1xuICAgICAgICAgICAgZWxlbS5jb21wb25lbnQgJiYgYWN0aXZlRWRpdG9yLmNvbXBvbmVudFxuICAgICAgICAgICAgICAmJiBlbGVtLmNvbXBvbmVudCA9PT0gYWN0aXZlRWRpdG9yLmNvbXBvbmVudCkpXG4gICAgICAgICAgLy8gT25seSBzaG93IGlmIGl0IHdhcyB0aGUgYWN0aXZlIGVkaXRvciBhbmQgaXQgaXMgYSB2YWxpZCBzY29wZVxuICAgICAgICAgIHJldHVybiBldnRJc0FjdGl2ZUVkaXRvciAmJiBoYXNWYWxpZFNjb3BlKGFjdGl2ZUVkaXRvciwgc2NvcGVzKVxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH0pKVxuXG4gICAgc2NoZWR1bGVJZGxlVGFza3MoKVxuICB9LFxuXG4gIGRlYWN0aXZhdGUoKSB7XG4gICAgaWRsZUNhbGxiYWNrcy5mb3JFYWNoKGNhbGxiYWNrSUQgPT4gd2luZG93LmNhbmNlbElkbGVDYWxsYmFjayhjYWxsYmFja0lEKSlcbiAgICBpZGxlQ2FsbGJhY2tzLmNsZWFyKClcbiAgICBpZiAoaGVscGVycykge1xuICAgICAgLy8gSWYgdGhlIGhlbHBlcnMgbW9kdWxlIGhhc24ndCBiZWVuIGxvYWRlZCB0aGVuIHRoZXJlIHdhcyBubyBjaGFuY2UgYVxuICAgICAgLy8gd29ya2VyIHdhcyBzdGFydGVkIGFueXdheS5cbiAgICAgIGhlbHBlcnMua2lsbFdvcmtlcigpXG4gICAgfVxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5kaXNwb3NlKClcbiAgfSxcblxuICBwcm92aWRlTGludGVyKCkge1xuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiAnRVNMaW50JyxcbiAgICAgIGdyYW1tYXJTY29wZXM6IHNjb3BlcyxcbiAgICAgIHNjb3BlOiAnZmlsZScsXG4gICAgICBsaW50c09uQ2hhbmdlOiB0cnVlLFxuICAgICAgLyoqXG4gICAgICAgKiBAcGFyYW0ge2ltcG9ydChcImF0b21cIikuVGV4dEVkaXRvcn0gdGV4dEVkaXRvclxuICAgICAgICogQHJldHVybnMge1Byb21pc2U8aW1wb3J0KFwiYXRvbS9saW50ZXJcIikuTWVzc2FnZVtdPn1cbiAgICAgICAqL1xuICAgICAgbGludDogYXN5bmMgKHRleHRFZGl0b3IpID0+IHtcbiAgICAgICAgaWYgKCFhdG9tLndvcmtzcGFjZS5pc1RleHRFZGl0b3IodGV4dEVkaXRvcikpIHtcbiAgICAgICAgICAvLyBJZiB3ZSBzb21laG93IGdldCBmZWQgYW4gaW52YWxpZCBUZXh0RWRpdG9yIGp1c3QgaW1tZWRpYXRlbHkgcmV0dXJuXG4gICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpbGVQYXRoID0gdGV4dEVkaXRvci5nZXRQYXRoKClcbiAgICAgICAgaWYgKCFmaWxlUGF0aCkge1xuICAgICAgICAgIC8vIFRoZSBlZGl0b3IgY3VycmVudGx5IGhhcyBubyBwYXRoLCB3ZSBjYW4ndCByZXBvcnQgbWVzc2FnZXMgYmFjayB0b1xuICAgICAgICAgIC8vIExpbnRlciBzbyBqdXN0IHJldHVybiBudWxsXG4gICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgfVxuXG5cbiAgICAgICAgaWYgKGZpbGVQYXRoLmluY2x1ZGVzKCc6Ly8nKSkge1xuICAgICAgICAgIC8vIElmIHRoZSBwYXRoIGlzIGEgVVJMIChOdWNsaWRlIHJlbW90ZSBmaWxlKSByZXR1cm4gYSBtZXNzYWdlXG4gICAgICAgICAgLy8gdGVsbGluZyB0aGUgdXNlciB3ZSBhcmUgdW5hYmxlIHRvIHdvcmsgb24gcmVtb3RlIGZpbGVzLlxuICAgICAgICAgIHJldHVybiBoZWxwZXJzLmdlbmVyYXRlVXNlck1lc3NhZ2UodGV4dEVkaXRvciwge1xuICAgICAgICAgICAgc2V2ZXJpdHk6ICd3YXJuaW5nJyxcbiAgICAgICAgICAgIGV4Y2VycHQ6ICdSZW1vdGUgZmlsZSBvcGVuLCBsaW50ZXItZXNsaW50IGlzIGRpc2FibGVkIGZvciB0aGlzIGZpbGUuJyxcbiAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGV4dCA9IHRleHRFZGl0b3IuZ2V0VGV4dCgpXG5cbiAgICAgICAgbGV0IHJ1bGVzID0ge31cbiAgICAgICAgaWYgKHRleHRFZGl0b3IuaXNNb2RpZmllZCgpKSB7XG4gICAgICAgICAgaWYgKGlnbm9yZUZpeGFibGVSdWxlc1doaWxlVHlwaW5nKSB7XG4gICAgICAgICAgICAvLyBOb3RlIHRoYXQgdGhlIGZpeGFibGUgcnVsZXMgd2lsbCBvbmx5IGhhdmUgdmFsdWVzIGFmdGVyIHRoZSBmaXJzdCBsaW50IGpvYlxuICAgICAgICAgICAgY29uc3QgaWdub3JlZFJ1bGVzID0gbmV3IFNldChoZWxwZXJzLnJ1bGVzLmdldEZpeGFibGVSdWxlcygpKVxuICAgICAgICAgICAgaWdub3JlZFJ1bGVzV2hlbk1vZGlmaWVkLmZvckVhY2gocnVsZUlkID0+IGlnbm9yZWRSdWxlcy5hZGQocnVsZUlkKSlcbiAgICAgICAgICAgIHJ1bGVzID0gaWRzVG9JZ25vcmVkUnVsZXMoaWdub3JlZFJ1bGVzKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBydWxlcyA9IGlkc1RvSWdub3JlZFJ1bGVzKGlnbm9yZWRSdWxlc1doZW5Nb2RpZmllZClcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgaGVscGVycy5zZW5kSm9iKHtcbiAgICAgICAgICAgIHR5cGU6ICdsaW50JyxcbiAgICAgICAgICAgIGNvbnRlbnRzOiB0ZXh0LFxuICAgICAgICAgICAgY29uZmlnOiBhdG9tLmNvbmZpZy5nZXQoJ2xpbnRlci1lc2xpbnQnKSxcbiAgICAgICAgICAgIHJ1bGVzLFxuICAgICAgICAgICAgZmlsZVBhdGgsXG4gICAgICAgICAgICBwcm9qZWN0UGF0aDogYXRvbS5wcm9qZWN0LnJlbGF0aXZpemVQYXRoKGZpbGVQYXRoKVswXSB8fCAnJ1xuICAgICAgICAgIH0pXG4gICAgICAgICAgaWYgKHRleHRFZGl0b3IuZ2V0VGV4dCgpICE9PSB0ZXh0KSB7XG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgVGhlIGVkaXRvciB0ZXh0IGhhcyBiZWVuIG1vZGlmaWVkIHNpbmNlIHRoZSBsaW50IHdhcyB0cmlnZ2VyZWQsXG4gICAgICAgICAgICBhcyB3ZSBjYW4ndCBiZSBzdXJlIHRoYXQgdGhlIHJlc3VsdHMgd2lsbCBtYXAgcHJvcGVybHkgYmFjayB0b1xuICAgICAgICAgICAgdGhlIG5ldyBjb250ZW50cywgc2ltcGx5IHJldHVybiBgbnVsbGAgdG8gdGVsbCB0aGVcbiAgICAgICAgICAgIGBwcm92aWRlTGludGVyYCBjb25zdW1lciBub3QgdG8gdXBkYXRlIHRoZSBzYXZlZCByZXN1bHRzLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHJldHVybiBudWxsXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBoZWxwZXJzLnByb2Nlc3NKb2JSZXNwb25zZShyZXNwb25zZSwgdGV4dEVkaXRvciwgc2hvd1J1bGUpXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgcmV0dXJuIGhlbHBlcnMuaGFuZGxlRXJyb3IodGV4dEVkaXRvciwgZXJyb3IpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgYXN5bmMgZml4Sm9iKGlzU2F2ZSA9IGZhbHNlKSB7XG4gICAgY29uc3QgdGV4dEVkaXRvciA9IGF0b20ud29ya3NwYWNlLmdldEFjdGl2ZVRleHRFZGl0b3IoKVxuXG4gICAgaWYgKCF0ZXh0RWRpdG9yIHx8ICFhdG9tLndvcmtzcGFjZS5pc1RleHRFZGl0b3IodGV4dEVkaXRvcikpIHtcbiAgICAgIC8vIFNpbGVudGx5IHJldHVybiBpZiB0aGUgVGV4dEVkaXRvciBpcyBpbnZhbGlkXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAodGV4dEVkaXRvci5pc01vZGlmaWVkKCkpIHtcbiAgICAgIC8vIEFib3J0IGZvciBpbnZhbGlkIG9yIHVuc2F2ZWQgdGV4dCBlZGl0b3JzXG4gICAgICBjb25zdCBtZXNzYWdlID0gJ0xpbnRlci1FU0xpbnQ6IFBsZWFzZSBzYXZlIGJlZm9yZSBmaXhpbmcnXG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRXJyb3IobWVzc2FnZSlcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlUGF0aCA9IHRleHRFZGl0b3IuZ2V0UGF0aCgpXG4gICAgY29uc3QgcHJvamVjdFBhdGggPSBhdG9tLnByb2plY3QucmVsYXRpdml6ZVBhdGgoZmlsZVBhdGgpWzBdXG5cbiAgICAvLyBHZXQgdGhlIHRleHQgZnJvbSB0aGUgZWRpdG9yLCBzbyB3ZSBjYW4gdXNlIGV4ZWN1dGVPblRleHRcbiAgICBjb25zdCB0ZXh0ID0gdGV4dEVkaXRvci5nZXRUZXh0KClcbiAgICAvLyBEbyBub3QgdHJ5IHRvIG1ha2UgZml4ZXMgb24gYW4gZW1wdHkgZmlsZVxuICAgIGlmICh0ZXh0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgbGV0IHJ1bGVzID0ge31cbiAgICBpZiAoT2JqZWN0LmtleXMoaWdub3JlZFJ1bGVzV2hlbkZpeGluZykubGVuZ3RoID4gMCkge1xuICAgICAgcnVsZXMgPSBpZ25vcmVkUnVsZXNXaGVuRml4aW5nXG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgaGVscGVycy5zZW5kSm9iKHtcbiAgICAgICAgdHlwZTogJ2ZpeCcsXG4gICAgICAgIGNvbmZpZzogYXRvbS5jb25maWcuZ2V0KCdsaW50ZXItZXNsaW50JyksXG4gICAgICAgIGNvbnRlbnRzOiB0ZXh0LFxuICAgICAgICBydWxlcyxcbiAgICAgICAgZmlsZVBhdGgsXG4gICAgICAgIHByb2plY3RQYXRoXG4gICAgICB9KVxuICAgICAgaWYgKCFpc1NhdmUpIHtcbiAgICAgICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZFN1Y2Nlc3MocmVzcG9uc2UpXG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkV2FybmluZyhlcnIubWVzc2FnZSlcbiAgICB9XG4gIH0sXG59XG4iXX0=