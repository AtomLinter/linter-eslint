'use babel'

import { generateRange } from 'atom-linter'
import { info as debugInfo } from '../debug'

const invalidTrace = async ({
  msgLine, msgCol, msgEndLine, msgEndCol,
  eslintFullRange, filePath, textEditor, ruleId, message
}) => {
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
    JSON.stringify(await debugInfo(), null, 2),
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
}

export default invalidTrace
