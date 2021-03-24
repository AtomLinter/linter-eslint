import { createPlugins } from 'rollup-plugin-atomic'

const plugins = createPlugins(['js', 'json', 'babel'])

export default [
  {
    input: 'src/main.js',
    output: [
      {
        dir: 'dist',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    external: ['atom'],
    plugins,
  },
]
