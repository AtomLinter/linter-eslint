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
      const eslint = Helpers.getESLintInstance(fileDir, config, projectPath); // Helpers.log(eslint)

      const fileConfig = Helpers.getConfigForFile(eslint, filePath);
      Helpers.log(fileConfig, config.disabling.disableWhenNoEslintConfig);

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
        stack: workerErr.stack
      });
    }
  });
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy93b3JrZXIuanMiXSwibmFtZXMiOlsicHJvY2VzcyIsInRpdGxlIiwicnVsZXNNZXRhZGF0YSIsIk1hcCIsInNob3VsZFNlbmRSdWxlcyIsImxpbnRKb2IiLCJjbGlFbmdpbmVPcHRpb25zIiwiY29udGVudHMiLCJlc2xpbnQiLCJmaWxlUGF0aCIsImNsaUVuZ2luZSIsIkNMSUVuZ2luZSIsInJlcG9ydCIsImV4ZWN1dGVPblRleHQiLCJydWxlcyIsIkhlbHBlcnMiLCJnZXRSdWxlcyIsImRpZFJ1bGVzQ2hhbmdlIiwiY2xlYXIiLCJmb3JFYWNoIiwicHJvcGVydGllcyIsInJ1bGUiLCJzZXQiLCJmaXhKb2IiLCJvdXRwdXRGaXhlcyIsInJlc3VsdHMiLCJsZW5ndGgiLCJtZXNzYWdlcyIsIm1vZHVsZSIsImV4cG9ydHMiLCJvbiIsImpvYkNvbmZpZyIsInR5cGUiLCJjb25maWciLCJwcm9qZWN0UGF0aCIsImVtaXRLZXkiLCJhZHZhbmNlZCIsImRpc2FibGVGU0NhY2hlIiwiRmluZENhY2hlIiwiZmlsZURpciIsIlBhdGgiLCJkaXJuYW1lIiwiZ2V0RVNMaW50SW5zdGFuY2UiLCJmaWxlQ29uZmlnIiwiZ2V0Q29uZmlnRm9yRmlsZSIsImxvZyIsImRpc2FibGluZyIsImRpc2FibGVXaGVuTm9Fc2xpbnRDb25maWciLCJlbWl0IiwicmVsYXRpdmVGaWxlUGF0aCIsImdldFJlbGF0aXZlUGF0aCIsImdldENMSUVuZ2luZU9wdGlvbnMiLCJyZXNwb25zZSIsInVwZGF0ZWRSdWxlcyIsIkFycmF5IiwiZnJvbSIsIm1vZHVsZXNEaXIiLCJmaW5kRVNMaW50RGlyZWN0b3J5Iiwid29ya2VyRXJyIiwibXNnIiwibWVzc2FnZSIsInN0YWNrIl0sIm1hcHBpbmdzIjoiOztBQUVBOztBQUNBOztBQUNBOzs7Ozs7QUFKQTtBQU1BQSxPQUFPLENBQUNDLEtBQVIsR0FBZ0Isc0JBQWhCO0FBRUEsTUFBTUMsYUFBYSxHQUFHLElBQUlDLEdBQUosRUFBdEI7QUFD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QUFBQSxRQUFRLEdBQUdyQyxPQUFPLENBQUMwQyxtQkFBUixDQUE0QkQsVUFBNUIsRUFBd0N2QixNQUF4QyxFQUFnREMsV0FBaEQsQ0FBWDtBQUNEOztBQUNEYyxNQUFBQSxJQUFJLENBQUNiLE9BQUQsRUFBVWlCLFFBQVYsQ0FBSjtBQUNELEtBdENELENBc0NFLE9BQU9NLFNBQVAsRUFBa0I7QUFDbEJWLE1BQUFBLElBQUksQ0FBRSxlQUFjYixPQUFRLEVBQXhCLEVBQTJCO0FBQUV3QixRQUFBQSxHQUFHLEVBQUVELFNBQVMsQ0FBQ0UsT0FBakI7QUFBMEJDLFFBQUFBLEtBQUssRUFBRUgsU0FBUyxDQUFDRztBQUEzQyxPQUEzQixDQUFKO0FBQ0Q7QUFDRixHQS9DRDtBQWdERCxDQWpERCIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCBlbWl0ICovXG5cbmltcG9ydCAqIGFzIFBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB7IEZpbmRDYWNoZSwgZmluZENhY2hlZCB9IGZyb20gJ2F0b20tbGludGVyJ1xuaW1wb3J0ICogYXMgSGVscGVycyBmcm9tICcuL3dvcmtlci1oZWxwZXJzJ1xuXG5wcm9jZXNzLnRpdGxlID0gJ2xpbnRlci1lc2xpbnQgaGVscGVyJ1xuXG5jb25zdCBydWxlc01ldGFkYXRhID0gbmV3IE1hcCgpXG5sZXQgc2hvdWxkU2VuZFJ1bGVzID0gZmFsc2VcblxuLyoqXG4gKiBUaGUgcmV0dXJuIG9mIHtnZXRDTElFbmdpbmVPcHRpb25zfSBmdW5jdGlvblxuICogQHR5cGVkZWYge29iamVjdH0gQ2xpRW5naW5lT3B0aW9uc1xuICogQHByb3BlcnR5IHtzdHJpbmdbXX0gcnVsZXNcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gaWdub3JlXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGZpeFxuICogQHByb3BlcnR5IHtzdHJpbmdbXX0gcnVsZVBhdGhzXG4gKiBAcHJvcGVydHkge3N0cmluZyB8IHVuZGVmaW5lZH0gY29uZmlnRmlsZVxuICovXG5cbi8qKlxuICogQHBhcmFtIHtDbGlFbmdpbmVPcHRpb25zfSBjbGlFbmdpbmVPcHRpb25zXG4gKiBAcGFyYW0ge3N0cmluZ30gY29udGVudHNcbiAqIEBwYXJhbSB7aW1wb3J0KFwiZXNsaW50XCIpfSBlc2xpbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlUGF0aFxuICovXG5mdW5jdGlvbiBsaW50Sm9iKGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoKSB7XG4gIGNvbnN0IGNsaUVuZ2luZSA9IG5ldyBlc2xpbnQuQ0xJRW5naW5lKGNsaUVuZ2luZU9wdGlvbnMpXG4gIGNvbnN0IHJlcG9ydCA9IGNsaUVuZ2luZS5leGVjdXRlT25UZXh0KGNvbnRlbnRzLCBmaWxlUGF0aClcbiAgY29uc3QgcnVsZXMgPSBIZWxwZXJzLmdldFJ1bGVzKGNsaUVuZ2luZSlcbiAgc2hvdWxkU2VuZFJ1bGVzID0gSGVscGVycy5kaWRSdWxlc0NoYW5nZShydWxlc01ldGFkYXRhLCBydWxlcylcbiAgaWYgKHNob3VsZFNlbmRSdWxlcykge1xuICAgIC8vIFJlYnVpbGQgcnVsZXNNZXRhZGF0YVxuICAgIHJ1bGVzTWV0YWRhdGEuY2xlYXIoKVxuICAgIHJ1bGVzLmZvckVhY2goKHByb3BlcnRpZXMsIHJ1bGUpID0+IHJ1bGVzTWV0YWRhdGEuc2V0KHJ1bGUsIHByb3BlcnRpZXMpKVxuICB9XG4gIHJldHVybiByZXBvcnRcbn1cblxuLyoqXG4gKiBAcGFyYW0ge0NsaUVuZ2luZU9wdGlvbnN9IGNsaUVuZ2luZU9wdGlvbnNcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb250ZW50c1xuICogQHBhcmFtIHtzdHJpbmd9IGZpbGVQYXRoXG4gKiBAcGFyYW0ge2ltcG9ydChcImVzbGludFwiKX0gZXNsaW50XG4gKi9cbmZ1bmN0aW9uIGZpeEpvYihjbGlFbmdpbmVPcHRpb25zLCBjb250ZW50cywgZXNsaW50LCBmaWxlUGF0aCkge1xuICBjb25zdCByZXBvcnQgPSBsaW50Sm9iKGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoKVxuXG4gIGVzbGludC5DTElFbmdpbmUub3V0cHV0Rml4ZXMocmVwb3J0KVxuXG4gIGlmICghcmVwb3J0LnJlc3VsdHMubGVuZ3RoIHx8ICFyZXBvcnQucmVzdWx0c1swXS5tZXNzYWdlcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJ0xpbnRlci1FU0xpbnQ6IEZpeCBjb21wbGV0ZS4nXG4gIH1cbiAgcmV0dXJuICdMaW50ZXItRVNMaW50OiBGaXggYXR0ZW1wdCBjb21wbGV0ZSwgYnV0IGxpbnRpbmcgZXJyb3JzIHJlbWFpbi4nXG59XG5cbm1vZHVsZS5leHBvcnRzID0gYXN5bmMgKCkgPT4ge1xuICBwcm9jZXNzLm9uKCdtZXNzYWdlJywgKGpvYkNvbmZpZykgPT4ge1xuICAgIC8vIFdlIGNhdGNoIGFsbCB3b3JrZXIgZXJyb3JzIHNvIHRoYXQgd2UgY2FuIGNyZWF0ZSBhIHNlcGFyYXRlIGVycm9yIGVtaXR0ZXJcbiAgICAvLyBmb3IgZWFjaCBlbWl0S2V5LCByYXRoZXIgdGhhbiBhZGRpbmcgbXVsdGlwbGUgbGlzdGVuZXJzIGZvciBgdGFzazplcnJvcmBcbiAgICBjb25zdCB7XG4gICAgICBjb250ZW50cywgdHlwZSwgY29uZmlnLCBmaWxlUGF0aCwgcHJvamVjdFBhdGgsIHJ1bGVzLCBlbWl0S2V5XG4gICAgfSA9IGpvYkNvbmZpZ1xuICAgIHRyeSB7XG4gICAgICBpZiAoY29uZmlnLmFkdmFuY2VkLmRpc2FibGVGU0NhY2hlKSB7XG4gICAgICAgIEZpbmRDYWNoZS5jbGVhcigpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpbGVEaXIgPSBQYXRoLmRpcm5hbWUoZmlsZVBhdGgpXG4gICAgICBjb25zdCBlc2xpbnQgPSBIZWxwZXJzLmdldEVTTGludEluc3RhbmNlKGZpbGVEaXIsIGNvbmZpZywgcHJvamVjdFBhdGgpXG4gICAgICAvLyBIZWxwZXJzLmxvZyhlc2xpbnQpXG5cbiAgICAgIGNvbnN0IGZpbGVDb25maWcgPSBIZWxwZXJzLmdldENvbmZpZ0ZvckZpbGUoZXNsaW50LCBmaWxlUGF0aClcbiAgICAgIEhlbHBlcnMubG9nKGZpbGVDb25maWcsIGNvbmZpZy5kaXNhYmxpbmcuZGlzYWJsZVdoZW5Ob0VzbGludENvbmZpZylcbiAgICAgIGlmIChmaWxlQ29uZmlnID09PSBudWxsICYmIGNvbmZpZy5kaXNhYmxpbmcuZGlzYWJsZVdoZW5Ob0VzbGludENvbmZpZykge1xuICAgICAgICBlbWl0KGVtaXRLZXksIHsgbWVzc2FnZXM6IFtdIH0pXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBjb25zdCByZWxhdGl2ZUZpbGVQYXRoID0gSGVscGVycy5nZXRSZWxhdGl2ZVBhdGgoZmlsZURpciwgZmlsZVBhdGgsIGNvbmZpZywgcHJvamVjdFBhdGgpXG5cbiAgICAgIGNvbnN0IGNsaUVuZ2luZU9wdGlvbnMgPSBIZWxwZXJzXG4gICAgICAgIC5nZXRDTElFbmdpbmVPcHRpb25zKHR5cGUsIGNvbmZpZywgcnVsZXMsIHJlbGF0aXZlRmlsZVBhdGgsIGZpbGVDb25maWcpXG5cbiAgICAgIGxldCByZXNwb25zZVxuICAgICAgaWYgKHR5cGUgPT09ICdsaW50Jykge1xuICAgICAgICBjb25zdCByZXBvcnQgPSBsaW50Sm9iKGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoKVxuICAgICAgICByZXNwb25zZSA9IHtcbiAgICAgICAgICBtZXNzYWdlczogcmVwb3J0LnJlc3VsdHMubGVuZ3RoID8gcmVwb3J0LnJlc3VsdHNbMF0ubWVzc2FnZXMgOiBbXVxuICAgICAgICB9XG4gICAgICAgIGlmIChzaG91bGRTZW5kUnVsZXMpIHtcbiAgICAgICAgICAvLyBZb3UgY2FuJ3QgZW1pdCBNYXBzLCBjb252ZXJ0IHRvIEFycmF5IG9mIEFycmF5cyB0byBzZW5kIGJhY2suXG4gICAgICAgICAgcmVzcG9uc2UudXBkYXRlZFJ1bGVzID0gQXJyYXkuZnJvbShydWxlc01ldGFkYXRhKVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdmaXgnKSB7XG4gICAgICAgIHJlc3BvbnNlID0gZml4Sm9iKGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoKVxuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnZGVidWcnKSB7XG4gICAgICAgIGNvbnN0IG1vZHVsZXNEaXIgPSBQYXRoLmRpcm5hbWUoZmluZENhY2hlZChmaWxlRGlyLCAnbm9kZV9tb2R1bGVzL2VzbGludCcpIHx8ICcnKVxuICAgICAgICByZXNwb25zZSA9IEhlbHBlcnMuZmluZEVTTGludERpcmVjdG9yeShtb2R1bGVzRGlyLCBjb25maWcsIHByb2plY3RQYXRoKVxuICAgICAgfVxuICAgICAgZW1pdChlbWl0S2V5LCByZXNwb25zZSlcbiAgICB9IGNhdGNoICh3b3JrZXJFcnIpIHtcbiAgICAgIGVtaXQoYHdvcmtlckVycm9yOiR7ZW1pdEtleX1gLCB7IG1zZzogd29ya2VyRXJyLm1lc3NhZ2UsIHN0YWNrOiB3b3JrZXJFcnIuc3RhY2sgfSlcbiAgICB9XG4gIH0pXG59XG4iXX0=