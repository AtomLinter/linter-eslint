'use babel'

import { normalize, join } from 'path'

// Immutable storage of path to bundled fallback ESLint directory.
//
const bundledESLintPath = normalize(join(__dirname, '..', '..', 'node_modules', 'eslint'))

export default () => bundledESLintPath
