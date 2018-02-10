
const { generateRange } = require('atom-linter')
const { info: debugInfo } = require('../debug')

const invalidTrace = ({
  msgLine, msgCol, msgEndLine, msgEndCol,
  eslintFullRange, filePath, textEditor, ruleId, message
}) =>
  debugInfo()
    .then((info) => {
      let errMsgRange = `${msgLine + 1}:${msgCol}`
      if (eslintFullRange) {
        errMsgRange += ` - ${msgEndLine + 1}:${msgEndCol + 1}`
      }
      const rangeText = `Requested ${eslintFullRange ? 'start point' : 'range'}: ${errMsgRange}`
      const issueURL = 'https://github.com/AtomLinter/linter-eslint/issues/new'
      const titleText = `Invalid position given by '${ruleId}'`
      const title = encodeURIComponent(titleText)
      const body = encodeURIComponent([
        'ESLint returned a point that did not exist in the document being edited.',
        `Rule: \`${ruleId}\``,
        rangeText,
        '', '',
        '<!-- If at all possible, please include code to reproduce this issue! -->',
        '', '',
        'Debug information:',
        '```json',
        JSON.stringify(info, null, 2),
        '```'
      ].join('\n'))

      const location = {
        file: filePath,
        position: generateRange(textEditor, 0),
      }
      const newIssueURL = `${issueURL}?title=${title}&body=${body}`

      return {
        severity: 'error',
        excerpt: `${titleText}. See the description for details. ` +
        'Click the URL to open a new issue!',
        url: newIssueURL,
        location,
        description: `${rangeText}\nOriginal message: ${message}`
      }
    })

module.exports = invalidTrace
