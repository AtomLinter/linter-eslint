"use strict";

var Path = _interopRequireWildcard(require("path"));

var _atomLinter = require("atom-linter");

var Helpers = _interopRequireWildcard(require("./worker-helpers"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

/* global emit */
process.title = 'linter-eslint helper';
const rulesMetadata = new Map();
let shouldSendRules = false;
/**
 * The return of {getCLIEngineOptions} function
 * @typedef {object} CliEngineOptions
 * @property {string[]} rules
 * @property {boolean} ignore
 * @property {boolean} fix
 * @property {string[]} rulePaths
 * @property {string | undefined} configFile
 */

/**
 * @param {CliEngineOptions} cliEngineOptions
 * @param {string} contents
 * @param {import("eslint")} eslint
 * @param {string} filePath
 */

function lintJob(cliEngineOptions, contents, eslint, filePath) {
  const cliEngine = new eslint.CLIEngine(cliEngineOptions);
  const report = cliEngine.executeOnText(contents, filePath);
  const rules = Helpers.getRules(cliEngine);
  shouldSendRules = Helpers.didRulesChange(rulesMetadata, rules);

  if (shouldSendRules) {
    // Rebuild rulesMetadata
    rulesMetadata.clear();
    rules.forEach((properties, rule) => rulesMetadata.set(rule, properties));
  }

  return report;
}
/**
 * @param {CliEngineOptions} cliEngineOptions
 * @param {string} contents
 * @param {string} filePath
 * @param {import("eslint")} eslint
 */


function fixJob(cliEngineOptions, contents, eslint, filePath) {
  const report = lintJob(cliEngineOptions, contents, eslint, filePath);
  eslint.CLIEngine.outputFixes(report);

  if (!report.results.length || !report.results[0].messages.length) {
    return 'Linter-ESLint: Fix complete.';
  }

  return 'Linter-ESLint: Fix attempt complete, but linting errors remain.';
}

module.exports = async () => {
  process.on('message', jobConfig => {
    // We catch all worker errors so that we can create a separate error emitter
    // for each emitKey, rather than adding multiple listeners for `task:error`
    const {
      contents,
      type,
      config,
      filePath,
      projectPath,
      rules,
      emitKey
    } = jobConfig;

    try {
      if (config.advanced.disableFSCache) {
        _atomLinter.FindCache.clear();
      }

      const fileDir = Path.dirname(filePath);
      const eslint = Helpers.getESLintInstance(fileDir, config, projectPath);
      const fileConfig = Helpers.getConfigForFile(eslint, filePath);

      if (fileConfig === null && config.disabling.disableWhenNoEslintConfig) {
        emit(emitKey, {
          messages: []
        });
        return;
      }

      const relativeFilePath = Helpers.getRelativePath(fileDir, filePath, config, projectPath);
      const cliEngineOptions = Helpers.getCLIEngineOptions(type, config, rules, relativeFilePath, fileConfig);
      let response;

      if (type === 'lint') {
        const report = lintJob(cliEngineOptions, contents, eslint, filePath);
        response = {
          messages: report.results.length ? report.results[0].messages : []
        };

        if (shouldSendRules) {
          // You can't emit Maps, convert to Array of Arrays to send back.
          response.updatedRules = Array.from(rulesMetadata);
        }
      } else if (type === 'fix') {
        response = fixJob(cliEngineOptions, contents, eslint, filePath);
      } else if (type === 'debug') {
        const modulesDir = Path.dirname((0, _atomLinter.findCached)(fileDir, 'node_modules/eslint') || '');
        response = Helpers.findESLintDirectory(modulesDir, config, projectPath);
      }

      emit(emitKey, response);
    } catch (workerErr) {
      emit(`workerError:${emitKey}`, {
        msg: workerErr.message,
        stack: workerErr.stack,
        name: workerErr.name
      });
    }
  });
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy93b3JrZXIuanMiXSwibmFtZXMiOlsicHJvY2VzcyIsInRpdGxlIiwicnVsZXNNZXRhZGF0YSIsIk1hcCIsInNob3VsZFNlbmRSdWxlcyIsImxpbnRKb2IiLCJjbGlFbmdpbmVPcHRpb25zIiwiY29udGVudHMiLCJlc2xpbnQiLCJmaWxlUGF0aCIsImNsaUVuZ2luZSIsIkNMSUVuZ2luZSIsInJlcG9ydCIsImV4ZWN1dGVPblRleHQiLCJydWxlcyIsIkhlbHBlcnMiLCJnZXRSdWxlcyIsImRpZFJ1bGVzQ2hhbmdlIiwiY2xlYXIiLCJmb3JFYWNoIiwicHJvcGVydGllcyIsInJ1bGUiLCJzZXQiLCJmaXhKb2IiLCJvdXRwdXRGaXhlcyIsInJlc3VsdHMiLCJsZW5ndGgiLCJtZXNzYWdlcyIsIm1vZHVsZSIsImV4cG9ydHMiLCJvbiIsImpvYkNvbmZpZyIsInR5cGUiLCJjb25maWciLCJwcm9qZWN0UGF0aCIsImVtaXRLZXkiLCJhZHZhbmNlZCIsImRpc2FibGVGU0NhY2hlIiwiRmluZENhY2hlIiwiZmlsZURpciIsIlBhdGgiLCJkaXJuYW1lIiwiZ2V0RVNMaW50SW5zdGFuY2UiLCJmaWxlQ29uZmlnIiwiZ2V0Q29uZmlnRm9yRmlsZSIsImRpc2FibGluZyIsImRpc2FibGVXaGVuTm9Fc2xpbnRDb25maWciLCJlbWl0IiwicmVsYXRpdmVGaWxlUGF0aCIsImdldFJlbGF0aXZlUGF0aCIsImdldENMSUVuZ2luZU9wdGlvbnMiLCJyZXNwb25zZSIsInVwZGF0ZWRSdWxlcyIsIkFycmF5IiwiZnJvbSIsIm1vZHVsZXNEaXIiLCJmaW5kRVNMaW50RGlyZWN0b3J5Iiwid29ya2VyRXJyIiwibXNnIiwibWVzc2FnZSIsInN0YWNrIiwibmFtZSJdLCJtYXBwaW5ncyI6Ijs7QUFFQTs7QUFDQTs7QUFDQTs7Ozs7O0FBSkE7QUFNQUEsT0FBTyxDQUFDQyxLQUFSLEdBQWdCLHNCQUFoQjtBQUVBLE1BQU1DLGFBQWEsR0FBRyxJQUFJQyxHQUFKLEVBQXRCO0FB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QUNEYSxNQUFBQSxJQUFJLENBQUNaLE9BQUQsRUFBVWdCLFFBQVYsQ0FBSjtBQUNELEtBcENELENBb0NFLE9BQU9NLFNBQVAsRUFBa0I7QUFDbEJWLE1BQUFBLElBQUksQ0FBRSxlQUFjWixPQUFRLEVBQXhCLEVBQTJCO0FBQzdCdUIsUUFBQUEsR0FBRyxFQUFFRCxTQUFTLENBQUNFLE9BRGM7QUFFN0JDLFFBQUFBLEtBQUssRUFBRUgsU0FBUyxDQUFDRyxLQUZZO0FBRzdCQyxRQUFBQSxJQUFJLEVBQUVKLFNBQVMsQ0FBQ0k7QUFIYSxPQUEzQixDQUFKO0FBS0Q7QUFDRixHQWpERDtBQWtERCxDQW5ERCIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCBlbWl0ICovXG5cbmltcG9ydCAqIGFzIFBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB7IEZpbmRDYWNoZSwgZmluZENhY2hlZCB9IGZyb20gJ2F0b20tbGludGVyJ1xuaW1wb3J0ICogYXMgSGVscGVycyBmcm9tICcuL3dvcmtlci1oZWxwZXJzJ1xuXG5wcm9jZXNzLnRpdGxlID0gJ2xpbnRlci1lc2xpbnQgaGVscGVyJ1xuXG5jb25zdCBydWxlc01ldGFkYXRhID0gbmV3IE1hcCgpXG5sZXQgc2hvdWxkU2VuZFJ1bGVzID0gZmFsc2VcblxuLyoqXG4gKiBUaGUgcmV0dXJuIG9mIHtnZXRDTElFbmdpbmVPcHRpb25zfSBmdW5jdGlvblxuICogQHR5cGVkZWYge29iamVjdH0gQ2xpRW5naW5lT3B0aW9uc1xuICogQHByb3BlcnR5IHtzdHJpbmdbXX0gcnVsZXNcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gaWdub3JlXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGZpeFxuICogQHByb3BlcnR5IHtzdHJpbmdbXX0gcnVsZVBhdGhzXG4gKiBAcHJvcGVydHkge3N0cmluZyB8IHVuZGVmaW5lZH0gY29uZmlnRmlsZVxuICovXG5cbi8qKlxuICogQHBhcmFtIHtDbGlFbmdpbmVPcHRpb25zfSBjbGlFbmdpbmVPcHRpb25zXG4gKiBAcGFyYW0ge3N0cmluZ30gY29udGVudHNcbiAqIEBwYXJhbSB7aW1wb3J0KFwiZXNsaW50XCIpfSBlc2xpbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlUGF0aFxuICovXG5mdW5jdGlvbiBsaW50Sm9iKGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoKSB7XG4gIGNvbnN0IGNsaUVuZ2luZSA9IG5ldyBlc2xpbnQuQ0xJRW5naW5lKGNsaUVuZ2luZU9wdGlvbnMpXG4gIGNvbnN0IHJlcG9ydCA9IGNsaUVuZ2luZS5leGVjdXRlT25UZXh0KGNvbnRlbnRzLCBmaWxlUGF0aClcbiAgY29uc3QgcnVsZXMgPSBIZWxwZXJzLmdldFJ1bGVzKGNsaUVuZ2luZSlcbiAgc2hvdWxkU2VuZFJ1bGVzID0gSGVscGVycy5kaWRSdWxlc0NoYW5nZShydWxlc01ldGFkYXRhLCBydWxlcylcbiAgaWYgKHNob3VsZFNlbmRSdWxlcykge1xuICAgIC8vIFJlYnVpbGQgcnVsZXNNZXRhZGF0YVxuICAgIHJ1bGVzTWV0YWRhdGEuY2xlYXIoKVxuICAgIHJ1bGVzLmZvckVhY2goKHByb3BlcnRpZXMsIHJ1bGUpID0+IHJ1bGVzTWV0YWRhdGEuc2V0KHJ1bGUsIHByb3BlcnRpZXMpKVxuICB9XG4gIHJldHVybiByZXBvcnRcbn1cblxuLyoqXG4gKiBAcGFyYW0ge0NsaUVuZ2luZU9wdGlvbnN9IGNsaUVuZ2luZU9wdGlvbnNcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb250ZW50c1xuICogQHBhcmFtIHtzdHJpbmd9IGZpbGVQYXRoXG4gKiBAcGFyYW0ge2ltcG9ydChcImVzbGludFwiKX0gZXNsaW50XG4gKi9cbmZ1bmN0aW9uIGZpeEpvYihjbGlFbmdpbmVPcHRpb25zLCBjb250ZW50cywgZXNsaW50LCBmaWxlUGF0aCkge1xuICBjb25zdCByZXBvcnQgPSBsaW50Sm9iKGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoKVxuXG4gIGVzbGludC5DTElFbmdpbmUub3V0cHV0Rml4ZXMocmVwb3J0KVxuXG4gIGlmICghcmVwb3J0LnJlc3VsdHMubGVuZ3RoIHx8ICFyZXBvcnQucmVzdWx0c1swXS5tZXNzYWdlcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJ0xpbnRlci1FU0xpbnQ6IEZpeCBjb21wbGV0ZS4nXG4gIH1cbiAgcmV0dXJuICdMaW50ZXItRVNMaW50OiBGaXggYXR0ZW1wdCBjb21wbGV0ZSwgYnV0IGxpbnRpbmcgZXJyb3JzIHJlbWFpbi4nXG59XG5cbm1vZHVsZS5leHBvcnRzID0gYXN5bmMgKCkgPT4ge1xuICBwcm9jZXNzLm9uKCdtZXNzYWdlJywgKGpvYkNvbmZpZykgPT4ge1xuICAgIC8vIFdlIGNhdGNoIGFsbCB3b3JrZXIgZXJyb3JzIHNvIHRoYXQgd2UgY2FuIGNyZWF0ZSBhIHNlcGFyYXRlIGVycm9yIGVtaXR0ZXJcbiAgICAvLyBmb3IgZWFjaCBlbWl0S2V5LCByYXRoZXIgdGhhbiBhZGRpbmcgbXVsdGlwbGUgbGlzdGVuZXJzIGZvciBgdGFzazplcnJvcmBcbiAgICBjb25zdCB7XG4gICAgICBjb250ZW50cywgdHlwZSwgY29uZmlnLCBmaWxlUGF0aCwgcHJvamVjdFBhdGgsIHJ1bGVzLCBlbWl0S2V5XG4gICAgfSA9IGpvYkNvbmZpZ1xuICAgIHRyeSB7XG4gICAgICBpZiAoY29uZmlnLmFkdmFuY2VkLmRpc2FibGVGU0NhY2hlKSB7XG4gICAgICAgIEZpbmRDYWNoZS5jbGVhcigpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpbGVEaXIgPSBQYXRoLmRpcm5hbWUoZmlsZVBhdGgpXG4gICAgICBjb25zdCBlc2xpbnQgPSBIZWxwZXJzLmdldEVTTGludEluc3RhbmNlKGZpbGVEaXIsIGNvbmZpZywgcHJvamVjdFBhdGgpXG5cbiAgICAgIGNvbnN0IGZpbGVDb25maWcgPSBIZWxwZXJzLmdldENvbmZpZ0ZvckZpbGUoZXNsaW50LCBmaWxlUGF0aClcbiAgICAgIGlmIChmaWxlQ29uZmlnID09PSBudWxsICYmIGNvbmZpZy5kaXNhYmxpbmcuZGlzYWJsZVdoZW5Ob0VzbGludENvbmZpZykge1xuICAgICAgICBlbWl0KGVtaXRLZXksIHsgbWVzc2FnZXM6IFtdIH0pXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBjb25zdCByZWxhdGl2ZUZpbGVQYXRoID0gSGVscGVycy5nZXRSZWxhdGl2ZVBhdGgoZmlsZURpciwgZmlsZVBhdGgsIGNvbmZpZywgcHJvamVjdFBhdGgpXG5cbiAgICAgIGNvbnN0IGNsaUVuZ2luZU9wdGlvbnMgPSBIZWxwZXJzXG4gICAgICAgIC5nZXRDTElFbmdpbmVPcHRpb25zKHR5cGUsIGNvbmZpZywgcnVsZXMsIHJlbGF0aXZlRmlsZVBhdGgsIGZpbGVDb25maWcpXG5cbiAgICAgIGxldCByZXNwb25zZVxuICAgICAgaWYgKHR5cGUgPT09ICdsaW50Jykge1xuICAgICAgICBjb25zdCByZXBvcnQgPSBsaW50Sm9iKGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoKVxuICAgICAgICByZXNwb25zZSA9IHtcbiAgICAgICAgICBtZXNzYWdlczogcmVwb3J0LnJlc3VsdHMubGVuZ3RoID8gcmVwb3J0LnJlc3VsdHNbMF0ubWVzc2FnZXMgOiBbXVxuICAgICAgICB9XG4gICAgICAgIGlmIChzaG91bGRTZW5kUnVsZXMpIHtcbiAgICAgICAgICAvLyBZb3UgY2FuJ3QgZW1pdCBNYXBzLCBjb252ZXJ0IHRvIEFycmF5IG9mIEFycmF5cyB0byBzZW5kIGJhY2suXG4gICAgICAgICAgcmVzcG9uc2UudXBkYXRlZFJ1bGVzID0gQXJyYXkuZnJvbShydWxlc01ldGFkYXRhKVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdmaXgnKSB7XG4gICAgICAgIHJlc3BvbnNlID0gZml4Sm9iKGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoKVxuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnZGVidWcnKSB7XG4gICAgICAgIGNvbnN0IG1vZHVsZXNEaXIgPSBQYXRoLmRpcm5hbWUoZmluZENhY2hlZChmaWxlRGlyLCAnbm9kZV9tb2R1bGVzL2VzbGludCcpIHx8ICcnKVxuICAgICAgICByZXNwb25zZSA9IEhlbHBlcnMuZmluZEVTTGludERpcmVjdG9yeShtb2R1bGVzRGlyLCBjb25maWcsIHByb2plY3RQYXRoKVxuICAgICAgfVxuICAgICAgZW1pdChlbWl0S2V5LCByZXNwb25zZSlcbiAgICB9IGNhdGNoICh3b3JrZXJFcnIpIHtcbiAgICAgIGVtaXQoYHdvcmtlckVycm9yOiR7ZW1pdEtleX1gLCB7XG4gICAgICAgIG1zZzogd29ya2VyRXJyLm1lc3NhZ2UsXG4gICAgICAgIHN0YWNrOiB3b3JrZXJFcnIuc3RhY2ssXG4gICAgICAgIG5hbWU6IHdvcmtlckVyci5uYW1lXG4gICAgICB9KVxuICAgIH1cbiAgfSlcbn1cbiJdfQ==