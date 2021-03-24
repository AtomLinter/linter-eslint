"use strict";

var _path = _interopRequireDefault(require("path"));

var _atomLinter = require("atom-linter");

var Helpers = _interopRequireWildcard(require("./worker-helpers"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* global emit */
process.title = 'linter-eslint helper';
const rulesMetadata = new Map();
let shouldSendRules = false;

function lintJob({
  cliEngineOptions,
  contents,
  eslint,
  filePath
}) {
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

function fixJob({
  cliEngineOptions,
  contents,
  eslint,
  filePath
}) {
  const report = lintJob({
    cliEngineOptions,
    contents,
    eslint,
    filePath
  });
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

      const fileDir = _path.default.dirname(filePath);

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
        const report = lintJob({
          cliEngineOptions,
          contents,
          eslint,
          filePath
        });
        response = {
          messages: report.results.length ? report.results[0].messages : []
        };

        if (shouldSendRules) {
          // You can't emit Maps, convert to Array of Arrays to send back.
          response.updatedRules = Array.from(rulesMetadata);
        }
      } else if (type === 'fix') {
        response = fixJob({
          cliEngineOptions,
          contents,
          eslint,
          filePath
        });
      } else if (type === 'debug') {
        const modulesDir = _path.default.dirname((0, _atomLinter.findCached)(fileDir, 'node_modules/eslint') || '');

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy93b3JrZXIuanMiXSwibmFtZXMiOlsicHJvY2VzcyIsInRpdGxlIiwicnVsZXNNZXRhZGF0YSIsIk1hcCIsInNob3VsZFNlbmRSdWxlcyIsImxpbnRKb2IiLCJjbGlFbmdpbmVPcHRpb25zIiwiY29udGVudHMiLCJlc2xpbnQiLCJmaWxlUGF0aCIsImNsaUVuZ2luZSIsIkNMSUVuZ2luZSIsInJlcG9ydCIsImV4ZWN1dGVPblRleHQiLCJydWxlcyIsIkhlbHBlcnMiLCJnZXRSdWxlcyIsImRpZFJ1bGVzQ2hhbmdlIiwiY2xlYXIiLCJmb3JFYWNoIiwicHJvcGVydGllcyIsInJ1bGUiLCJzZXQiLCJmaXhKb2IiLCJvdXRwdXRGaXhlcyIsInJlc3VsdHMiLCJsZW5ndGgiLCJtZXNzYWdlcyIsIm1vZHVsZSIsImV4cG9ydHMiLCJvbiIsImpvYkNvbmZpZyIsInR5cGUiLCJjb25maWciLCJwcm9qZWN0UGF0aCIsImVtaXRLZXkiLCJhZHZhbmNlZCIsImRpc2FibGVGU0NhY2hlIiwiRmluZENhY2hlIiwiZmlsZURpciIsIlBhdGgiLCJkaXJuYW1lIiwiZ2V0RVNMaW50SW5zdGFuY2UiLCJmaWxlQ29uZmlnIiwiZ2V0Q29uZmlnRm9yRmlsZSIsImRpc2FibGluZyIsImRpc2FibGVXaGVuTm9Fc2xpbnRDb25maWciLCJlbWl0IiwicmVsYXRpdmVGaWxlUGF0aCIsImdldFJlbGF0aXZlUGF0aCIsImdldENMSUVuZ2luZU9wdGlvbnMiLCJyZXNwb25zZSIsInVwZGF0ZWRSdWxlcyIsIkFycmF5IiwiZnJvbSIsIm1vZHVsZXNEaXIiLCJmaW5kRVNMaW50RGlyZWN0b3J5Iiwid29ya2VyRXJyIiwibXNnIiwibWVzc2FnZSIsInN0YWNrIl0sIm1hcHBpbmdzIjoiOztBQUVBOztBQUNBOztBQUNBOzs7Ozs7OztBQUpBO0FBTUFBLE9BQU8sQ0FBQ0MsS0FBUixHQUFnQixzQkFBaEI7QUFFQSxNQUFNQyxhQUFhLEdBQUcsSUFBSUMsR0FBSixFQUF0QjtBQUNBLElB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QTRCRCxVQUE1QixFQUF3Q3RCLE1BQXhDLEVBQWdEQyxXQUFoRCxDQUFYO0FBQ0Q7O0FBQ0RhLE1BQUFBLElBQUksQ0FBQ1osT0FBRCxFQUFVZ0IsUUFBVixDQUFKO0FBQ0QsS0FwQ0QsQ0FvQ0UsT0FBT00sU0FBUCxFQUFrQjtBQUNsQlYsTUFBQUEsSUFBSSxDQUFFLGVBQWNaLE9BQVEsRUFBeEIsRUFBMkI7QUFBRXVCLFFBQUFBLEdBQUcsRUFBRUQsU0FBUyxDQUFDRSxPQUFqQjtBQUEwQkMsUUFBQUEsS0FBSyxFQUFFSCxTQUFTLENBQUNHO0FBQTNDLE9BQTNCLENBQUo7QUFDRDtBQUNGLEdBN0NEO0FBOENELENBL0NEIiwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFsIGVtaXQgKi9cblxuaW1wb3J0IFBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB7IEZpbmRDYWNoZSwgZmluZENhY2hlZCB9IGZyb20gJ2F0b20tbGludGVyJ1xuaW1wb3J0ICogYXMgSGVscGVycyBmcm9tICcuL3dvcmtlci1oZWxwZXJzJ1xuXG5wcm9jZXNzLnRpdGxlID0gJ2xpbnRlci1lc2xpbnQgaGVscGVyJ1xuXG5jb25zdCBydWxlc01ldGFkYXRhID0gbmV3IE1hcCgpXG5sZXQgc2hvdWxkU2VuZFJ1bGVzID0gZmFsc2VcblxuZnVuY3Rpb24gbGludEpvYih7IGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoIH0pIHtcbiAgY29uc3QgY2xpRW5naW5lID0gbmV3IGVzbGludC5DTElFbmdpbmUoY2xpRW5naW5lT3B0aW9ucylcbiAgY29uc3QgcmVwb3J0ID0gY2xpRW5naW5lLmV4ZWN1dGVPblRleHQoY29udGVudHMsIGZpbGVQYXRoKVxuICBjb25zdCBydWxlcyA9IEhlbHBlcnMuZ2V0UnVsZXMoY2xpRW5naW5lKVxuICBzaG91bGRTZW5kUnVsZXMgPSBIZWxwZXJzLmRpZFJ1bGVzQ2hhbmdlKHJ1bGVzTWV0YWRhdGEsIHJ1bGVzKVxuICBpZiAoc2hvdWxkU2VuZFJ1bGVzKSB7XG4gICAgLy8gUmVidWlsZCBydWxlc01ldGFkYXRhXG4gICAgcnVsZXNNZXRhZGF0YS5jbGVhcigpXG4gICAgcnVsZXMuZm9yRWFjaCgocHJvcGVydGllcywgcnVsZSkgPT4gcnVsZXNNZXRhZGF0YS5zZXQocnVsZSwgcHJvcGVydGllcykpXG4gIH1cbiAgcmV0dXJuIHJlcG9ydFxufVxuXG5mdW5jdGlvbiBmaXhKb2IoeyBjbGlFbmdpbmVPcHRpb25zLCBjb250ZW50cywgZXNsaW50LCBmaWxlUGF0aCB9KSB7XG4gIGNvbnN0IHJlcG9ydCA9IGxpbnRKb2IoeyBjbGlFbmdpbmVPcHRpb25zLCBjb250ZW50cywgZXNsaW50LCBmaWxlUGF0aCB9KVxuXG4gIGVzbGludC5DTElFbmdpbmUub3V0cHV0Rml4ZXMocmVwb3J0KVxuXG4gIGlmICghcmVwb3J0LnJlc3VsdHMubGVuZ3RoIHx8ICFyZXBvcnQucmVzdWx0c1swXS5tZXNzYWdlcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJ0xpbnRlci1FU0xpbnQ6IEZpeCBjb21wbGV0ZS4nXG4gIH1cbiAgcmV0dXJuICdMaW50ZXItRVNMaW50OiBGaXggYXR0ZW1wdCBjb21wbGV0ZSwgYnV0IGxpbnRpbmcgZXJyb3JzIHJlbWFpbi4nXG59XG5cbm1vZHVsZS5leHBvcnRzID0gYXN5bmMgKCkgPT4ge1xuICBwcm9jZXNzLm9uKCdtZXNzYWdlJywgKGpvYkNvbmZpZykgPT4ge1xuICAgIC8vIFdlIGNhdGNoIGFsbCB3b3JrZXIgZXJyb3JzIHNvIHRoYXQgd2UgY2FuIGNyZWF0ZSBhIHNlcGFyYXRlIGVycm9yIGVtaXR0ZXJcbiAgICAvLyBmb3IgZWFjaCBlbWl0S2V5LCByYXRoZXIgdGhhbiBhZGRpbmcgbXVsdGlwbGUgbGlzdGVuZXJzIGZvciBgdGFzazplcnJvcmBcbiAgICBjb25zdCB7XG4gICAgICBjb250ZW50cywgdHlwZSwgY29uZmlnLCBmaWxlUGF0aCwgcHJvamVjdFBhdGgsIHJ1bGVzLCBlbWl0S2V5XG4gICAgfSA9IGpvYkNvbmZpZ1xuICAgIHRyeSB7XG4gICAgICBpZiAoY29uZmlnLmFkdmFuY2VkLmRpc2FibGVGU0NhY2hlKSB7XG4gICAgICAgIEZpbmRDYWNoZS5jbGVhcigpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpbGVEaXIgPSBQYXRoLmRpcm5hbWUoZmlsZVBhdGgpXG4gICAgICBjb25zdCBlc2xpbnQgPSBIZWxwZXJzLmdldEVTTGludEluc3RhbmNlKGZpbGVEaXIsIGNvbmZpZywgcHJvamVjdFBhdGgpXG5cbiAgICAgIGNvbnN0IGZpbGVDb25maWcgPSBIZWxwZXJzLmdldENvbmZpZ0ZvckZpbGUoZXNsaW50LCBmaWxlUGF0aClcbiAgICAgIGlmIChmaWxlQ29uZmlnID09PSBudWxsICYmIGNvbmZpZy5kaXNhYmxpbmcuZGlzYWJsZVdoZW5Ob0VzbGludENvbmZpZykge1xuICAgICAgICBlbWl0KGVtaXRLZXksIHsgbWVzc2FnZXM6IFtdIH0pXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBjb25zdCByZWxhdGl2ZUZpbGVQYXRoID0gSGVscGVycy5nZXRSZWxhdGl2ZVBhdGgoZmlsZURpciwgZmlsZVBhdGgsIGNvbmZpZywgcHJvamVjdFBhdGgpXG5cbiAgICAgIGNvbnN0IGNsaUVuZ2luZU9wdGlvbnMgPSBIZWxwZXJzXG4gICAgICAgIC5nZXRDTElFbmdpbmVPcHRpb25zKHR5cGUsIGNvbmZpZywgcnVsZXMsIHJlbGF0aXZlRmlsZVBhdGgsIGZpbGVDb25maWcpXG5cbiAgICAgIGxldCByZXNwb25zZVxuICAgICAgaWYgKHR5cGUgPT09ICdsaW50Jykge1xuICAgICAgICBjb25zdCByZXBvcnQgPSBsaW50Sm9iKHsgY2xpRW5naW5lT3B0aW9ucywgY29udGVudHMsIGVzbGludCwgZmlsZVBhdGggfSlcbiAgICAgICAgcmVzcG9uc2UgPSB7XG4gICAgICAgICAgbWVzc2FnZXM6IHJlcG9ydC5yZXN1bHRzLmxlbmd0aCA/IHJlcG9ydC5yZXN1bHRzWzBdLm1lc3NhZ2VzIDogW11cbiAgICAgICAgfVxuICAgICAgICBpZiAoc2hvdWxkU2VuZFJ1bGVzKSB7XG4gICAgICAgICAgLy8gWW91IGNhbid0IGVtaXQgTWFwcywgY29udmVydCB0byBBcnJheSBvZiBBcnJheXMgdG8gc2VuZCBiYWNrLlxuICAgICAgICAgIHJlc3BvbnNlLnVwZGF0ZWRSdWxlcyA9IEFycmF5LmZyb20ocnVsZXNNZXRhZGF0YSlcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnZml4Jykge1xuICAgICAgICByZXNwb25zZSA9IGZpeEpvYih7IGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoIH0pXG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdkZWJ1ZycpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlc0RpciA9IFBhdGguZGlybmFtZShmaW5kQ2FjaGVkKGZpbGVEaXIsICdub2RlX21vZHVsZXMvZXNsaW50JykgfHwgJycpXG4gICAgICAgIHJlc3BvbnNlID0gSGVscGVycy5maW5kRVNMaW50RGlyZWN0b3J5KG1vZHVsZXNEaXIsIGNvbmZpZywgcHJvamVjdFBhdGgpXG4gICAgICB9XG4gICAgICBlbWl0KGVtaXRLZXksIHJlc3BvbnNlKVxuICAgIH0gY2F0Y2ggKHdvcmtlckVycikge1xuICAgICAgZW1pdChgd29ya2VyRXJyb3I6JHtlbWl0S2V5fWAsIHsgbXNnOiB3b3JrZXJFcnIubWVzc2FnZSwgc3RhY2s6IHdvcmtlckVyci5zdGFjayB9KVxuICAgIH1cbiAgfSlcbn1cbiJdfQ==