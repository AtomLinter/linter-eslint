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
        stack: workerErr.stack
      });
    }
  });
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy93b3JrZXIuanMiXSwibmFtZXMiOlsicHJvY2VzcyIsInRpdGxlIiwicnVsZXNNZXRhZGF0YSIsIk1hcCIsInNob3VsZFNlbmRSdWxlcyIsImxpbnRKb2IiLCJjbGlFbmdpbmVPcHRpb25zIiwiY29udGVudHMiLCJlc2xpbnQiLCJmaWxlUGF0aCIsImNsaUVuZ2luZSIsIkNMSUVuZ2luZSIsInJlcG9ydCIsImV4ZWN1dGVPblRleHQiLCJydWxlcyIsIkhlbHBlcnMiLCJnZXRSdWxlcyIsImRpZFJ1bGVzQ2hhbmdlIiwiY2xlYXIiLCJmb3JFYWNoIiwicHJvcGVydGllcyIsInJ1bGUiLCJzZXQiLCJmaXhKb2IiLCJvdXRwdXRGaXhlcyIsInJlc3VsdHMiLCJsZW5ndGgiLCJtZXNzYWdlcyIsIm1vZHVsZSIsImV4cG9ydHMiLCJvbiIsImpvYkNvbmZpZyIsInR5cGUiLCJjb25maWciLCJwcm9qZWN0UGF0aCIsImVtaXRLZXkiLCJhZHZhbmNlZCIsImRpc2FibGVGU0NhY2hlIiwiRmluZENhY2hlIiwiZmlsZURpciIsIlBhdGgiLCJkaXJuYW1lIiwiZ2V0RVNMaW50SW5zdGFuY2UiLCJmaWxlQ29uZmlnIiwiZ2V0Q29uZmlnRm9yRmlsZSIsImRpc2FibGluZyIsImRpc2FibGVXaGVuTm9Fc2xpbnRDb25maWciLCJlbWl0IiwicmVsYXRpdmVGaWxlUGF0aCIsImdldFJlbGF0aXZlUGF0aCIsImdldENMSUVuZ2luZU9wdGlvbnMiLCJyZXNwb25zZSIsInVwZGF0ZWRSdWxlcyIsIkFycmF5IiwiZnJvbSIsIm1vZHVsZXNEaXIiLCJmaW5kRVNMaW50RGlyZWN0b3J5Iiwid29ya2VyRXJyIiwibXNnIiwibWVzc2FnZSIsInN0YWNrIl0sIm1hcHBpbmdzIjoiOztBQUVBOztBQUNBOztBQUNBOzs7Ozs7QUFKQTtBQU1BQSxPQUFPLENBQUNDLEtBQVIsR0FBZ0Isc0JBQWhCO0FBRUEsTUFBTUMsYUFBYSxHQUFHLElBQUlDLEdBQUosRUFBdEI7QUFDQSxJQUFJ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QUFBLElBQUksQ0FBQ1osT0FBRCxFQUFVZ0IsUUFBVixDQUFKO0FBQ0QsS0FwQ0QsQ0FvQ0UsT0FBT00sU0FBUCxFQUFrQjtBQUNsQlYsTUFBQUEsSUFBSSxDQUFFLGVBQWNaLE9BQVEsRUFBeEIsRUFBMkI7QUFBRXVCLFFBQUFBLEdBQUcsRUFBRUQsU0FBUyxDQUFDRSxPQUFqQjtBQUEwQkMsUUFBQUEsS0FBSyxFQUFFSCxTQUFTLENBQUNHO0FBQTNDLE9BQTNCLENBQUo7QUFDRDtBQUNGLEdBN0NEO0FBOENELENBL0NEIiwic291cmNlc0NvbnRlbnQiOlsiLyogZ2xvYmFsIGVtaXQgKi9cblxuaW1wb3J0ICogYXMgUGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgRmluZENhY2hlLCBmaW5kQ2FjaGVkIH0gZnJvbSAnYXRvbS1saW50ZXInXG5pbXBvcnQgKiBhcyBIZWxwZXJzIGZyb20gJy4vd29ya2VyLWhlbHBlcnMnXG5cbnByb2Nlc3MudGl0bGUgPSAnbGludGVyLWVzbGludCBoZWxwZXInXG5cbmNvbnN0IHJ1bGVzTWV0YWRhdGEgPSBuZXcgTWFwKClcbmxldCBzaG91bGRTZW5kUnVsZXMgPSBmYWxzZVxuXG4vKipcbiAqIFRoZSByZXR1cm4gb2Yge2dldENMSUVuZ2luZU9wdGlvbnN9IGZ1bmN0aW9uXG4gKiBAdHlwZWRlZiB7b2JqZWN0fSBDbGlFbmdpbmVPcHRpb25zXG4gKiBAcHJvcGVydHkge3N0cmluZ1tdfSBydWxlc1xuICogQHByb3BlcnR5IHtib29sZWFufSBpZ25vcmVcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZml4XG4gKiBAcHJvcGVydHkge3N0cmluZ1tdfSBydWxlUGF0aHNcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nIHwgdW5kZWZpbmVkfSBjb25maWdGaWxlXG4gKi9cblxuLyoqXG4gKiBAcGFyYW0ge0NsaUVuZ2luZU9wdGlvbnN9IGNsaUVuZ2luZU9wdGlvbnNcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb250ZW50c1xuICogQHBhcmFtIHtpbXBvcnQoXCJlc2xpbnRcIil9IGVzbGludFxuICogQHBhcmFtIHtzdHJpbmd9IGZpbGVQYXRoXG4gKi9cbmZ1bmN0aW9uIGxpbnRKb2IoY2xpRW5naW5lT3B0aW9ucywgY29udGVudHMsIGVzbGludCwgZmlsZVBhdGgpIHtcbiAgY29uc3QgY2xpRW5naW5lID0gbmV3IGVzbGludC5DTElFbmdpbmUoY2xpRW5naW5lT3B0aW9ucylcbiAgY29uc3QgcmVwb3J0ID0gY2xpRW5naW5lLmV4ZWN1dGVPblRleHQoY29udGVudHMsIGZpbGVQYXRoKVxuICBjb25zdCBydWxlcyA9IEhlbHBlcnMuZ2V0UnVsZXMoY2xpRW5naW5lKVxuICBzaG91bGRTZW5kUnVsZXMgPSBIZWxwZXJzLmRpZFJ1bGVzQ2hhbmdlKHJ1bGVzTWV0YWRhdGEsIHJ1bGVzKVxuICBpZiAoc2hvdWxkU2VuZFJ1bGVzKSB7XG4gICAgLy8gUmVidWlsZCBydWxlc01ldGFkYXRhXG4gICAgcnVsZXNNZXRhZGF0YS5jbGVhcigpXG4gICAgcnVsZXMuZm9yRWFjaCgocHJvcGVydGllcywgcnVsZSkgPT4gcnVsZXNNZXRhZGF0YS5zZXQocnVsZSwgcHJvcGVydGllcykpXG4gIH1cbiAgcmV0dXJuIHJlcG9ydFxufVxuXG4vKipcbiAqIEBwYXJhbSB7Q2xpRW5naW5lT3B0aW9uc30gY2xpRW5naW5lT3B0aW9uc1xuICogQHBhcmFtIHtzdHJpbmd9IGNvbnRlbnRzXG4gKiBAcGFyYW0ge3N0cmluZ30gZmlsZVBhdGhcbiAqIEBwYXJhbSB7aW1wb3J0KFwiZXNsaW50XCIpfSBlc2xpbnRcbiAqL1xuZnVuY3Rpb24gZml4Sm9iKGNsaUVuZ2luZU9wdGlvbnMsIGNvbnRlbnRzLCBlc2xpbnQsIGZpbGVQYXRoKSB7XG4gIGNvbnN0IHJlcG9ydCA9IGxpbnRKb2IoY2xpRW5naW5lT3B0aW9ucywgY29udGVudHMsIGVzbGludCwgZmlsZVBhdGgpXG5cbiAgZXNsaW50LkNMSUVuZ2luZS5vdXRwdXRGaXhlcyhyZXBvcnQpXG5cbiAgaWYgKCFyZXBvcnQucmVzdWx0cy5sZW5ndGggfHwgIXJlcG9ydC5yZXN1bHRzWzBdLm1lc3NhZ2VzLmxlbmd0aCkge1xuICAgIHJldHVybiAnTGludGVyLUVTTGludDogRml4IGNvbXBsZXRlLidcbiAgfVxuICByZXR1cm4gJ0xpbnRlci1FU0xpbnQ6IEZpeCBhdHRlbXB0IGNvbXBsZXRlLCBidXQgbGludGluZyBlcnJvcnMgcmVtYWluLidcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhc3luYyAoKSA9PiB7XG4gIHByb2Nlc3Mub24oJ21lc3NhZ2UnLCAoam9iQ29uZmlnKSA9PiB7XG4gICAgLy8gV2UgY2F0Y2ggYWxsIHdvcmtlciBlcnJvcnMgc28gdGhhdCB3ZSBjYW4gY3JlYXRlIGEgc2VwYXJhdGUgZXJyb3IgZW1pdHRlclxuICAgIC8vIGZvciBlYWNoIGVtaXRLZXksIHJhdGhlciB0aGFuIGFkZGluZyBtdWx0aXBsZSBsaXN0ZW5lcnMgZm9yIGB0YXNrOmVycm9yYFxuICAgIGNvbnN0IHtcbiAgICAgIGNvbnRlbnRzLCB0eXBlLCBjb25maWcsIGZpbGVQYXRoLCBwcm9qZWN0UGF0aCwgcnVsZXMsIGVtaXRLZXlcbiAgICB9ID0gam9iQ29uZmlnXG4gICAgdHJ5IHtcbiAgICAgIGlmIChjb25maWcuYWR2YW5jZWQuZGlzYWJsZUZTQ2FjaGUpIHtcbiAgICAgICAgRmluZENhY2hlLmNsZWFyKClcbiAgICAgIH1cblxuICAgICAgY29uc3QgZmlsZURpciA9IFBhdGguZGlybmFtZShmaWxlUGF0aClcbiAgICAgIGNvbnN0IGVzbGludCA9IEhlbHBlcnMuZ2V0RVNMaW50SW5zdGFuY2UoZmlsZURpciwgY29uZmlnLCBwcm9qZWN0UGF0aClcblxuICAgICAgY29uc3QgZmlsZUNvbmZpZyA9IEhlbHBlcnMuZ2V0Q29uZmlnRm9yRmlsZShlc2xpbnQsIGZpbGVQYXRoKVxuICAgICAgaWYgKGZpbGVDb25maWcgPT09IG51bGwgJiYgY29uZmlnLmRpc2FibGluZy5kaXNhYmxlV2hlbk5vRXNsaW50Q29uZmlnKSB7XG4gICAgICAgIGVtaXQoZW1pdEtleSwgeyBtZXNzYWdlczogW10gfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlbGF0aXZlRmlsZVBhdGggPSBIZWxwZXJzLmdldFJlbGF0aXZlUGF0aChmaWxlRGlyLCBmaWxlUGF0aCwgY29uZmlnLCBwcm9qZWN0UGF0aClcblxuICAgICAgY29uc3QgY2xpRW5naW5lT3B0aW9ucyA9IEhlbHBlcnNcbiAgICAgICAgLmdldENMSUVuZ2luZU9wdGlvbnModHlwZSwgY29uZmlnLCBydWxlcywgcmVsYXRpdmVGaWxlUGF0aCwgZmlsZUNvbmZpZylcblxuICAgICAgbGV0IHJlc3BvbnNlXG4gICAgICBpZiAodHlwZSA9PT0gJ2xpbnQnKSB7XG4gICAgICAgIGNvbnN0IHJlcG9ydCA9IGxpbnRKb2IoY2xpRW5naW5lT3B0aW9ucywgY29udGVudHMsIGVzbGludCwgZmlsZVBhdGgpXG4gICAgICAgIHJlc3BvbnNlID0ge1xuICAgICAgICAgIG1lc3NhZ2VzOiByZXBvcnQucmVzdWx0cy5sZW5ndGggPyByZXBvcnQucmVzdWx0c1swXS5tZXNzYWdlcyA6IFtdXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNob3VsZFNlbmRSdWxlcykge1xuICAgICAgICAgIC8vIFlvdSBjYW4ndCBlbWl0IE1hcHMsIGNvbnZlcnQgdG8gQXJyYXkgb2YgQXJyYXlzIHRvIHNlbmQgYmFjay5cbiAgICAgICAgICByZXNwb25zZS51cGRhdGVkUnVsZXMgPSBBcnJheS5mcm9tKHJ1bGVzTWV0YWRhdGEpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2ZpeCcpIHtcbiAgICAgICAgcmVzcG9uc2UgPSBmaXhKb2IoY2xpRW5naW5lT3B0aW9ucywgY29udGVudHMsIGVzbGludCwgZmlsZVBhdGgpXG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdkZWJ1ZycpIHtcbiAgICAgICAgY29uc3QgbW9kdWxlc0RpciA9IFBhdGguZGlybmFtZShmaW5kQ2FjaGVkKGZpbGVEaXIsICdub2RlX21vZHVsZXMvZXNsaW50JykgfHwgJycpXG4gICAgICAgIHJlc3BvbnNlID0gSGVscGVycy5maW5kRVNMaW50RGlyZWN0b3J5KG1vZHVsZXNEaXIsIGNvbmZpZywgcHJvamVjdFBhdGgpXG4gICAgICB9XG4gICAgICBlbWl0KGVtaXRLZXksIHJlc3BvbnNlKVxuICAgIH0gY2F0Y2ggKHdvcmtlckVycikge1xuICAgICAgZW1pdChgd29ya2VyRXJyb3I6JHtlbWl0S2V5fWAsIHsgbXNnOiB3b3JrZXJFcnIubWVzc2FnZSwgc3RhY2s6IHdvcmtlckVyci5zdGFjayB9KVxuICAgIH1cbiAgfSlcbn1cbiJdfQ==