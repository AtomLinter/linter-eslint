'use babel';

describe('The eslint provider for Linter', () => {
  const {spawnWorker} = require('../lib/helpers')
  const worker = spawnWorker()
  const lint = require('../lib/main').provideLinter.call(worker).lint;

  beforeEach(() => {
    waitsForPromise(() => {
      return atom.packages.activatePackage('language-javascript').then(() =>
        atom.workspace.open(__dirname + '/fixtures/files/good.js')
      )
    });
  });

  describe('checks bad.js and', () => {
    let editor = null;
    beforeEach(() => {
      waitsForPromise(() => {
        atom.config.set('linter-eslint.disableEslintIgnore', true);
        return atom.workspace.open(__dirname + '/fixtures/files/bad.js').then(openEditor => {
          editor = openEditor;
        });
      });
    });

    it('finds at least one message', () => {
      return lint(editor).then(messages => {
        expect(messages.length).toBeGreaterThan(0);
      });
    });

    it('verifies that message', () => {
      return lint(editor).then(messages => {
        expect(messages[0].type).toBeDefined();
        expect(messages[0].type).toEqual('Error');
        expect(messages[0].html).not.toBeDefined();
        expect(messages[0].text).toBeDefined();
        expect(messages[0].text).toEqual('"foo" is not defined.');
        expect(messages[0].filePath).toBeDefined();
        expect(messages[0].filePath).toMatch(/.+spec[\\\/]fixtures[\\\/]files[\\\/]bad\.js$/);
        expect(messages[0].range).toBeDefined();
        expect(messages[0].range.length).toEqual(2);
        expect(messages[0].range).toEqual([[0, 0], [0, 9]]);
      });
    });
  });

  it('finds nothing wrong with an empty file', () => {
    waitsForPromise(() => {
      return atom.workspace.open(__dirname + '/fixtures/files/empty.js').then(editor => {
        return lint(editor).then(messages => {
          expect(messages.length).toEqual(0);
        });
      });
    })
  });

  it('finds nothing wrong with a valid file', () => {
    waitsForPromise(() => {
      return atom.workspace.open(__dirname + '/fixtures/files/good.js').then(editor => {
        return lint(editor).then(messages => {
          expect(messages.length).toEqual(0);
        });
      });
    })
  });

  describe('when resolving import paths using eslint-plugin-import', () => {
    it('correctly resolves imports from parent', () => {
      waitsForPromise(() => {
        return atom.workspace.open(`${__dirname}/fixtures/import-resolution/nested/importing.js`).then(editor => {
          return lint(editor).then(messages => {
            expect(messages.length).toEqual(0);
          })
        })
      })
    })
  })

  describe('when a file is specified in an .eslintignore file', () => {
    it('will not give warnings for the file', () => {
      waitsForPromise(() => {
        return atom.workspace.open(`${__dirname}/fixtures/eslintignore/ignored.js`).then(editor => {
          return lint(editor).then(messages => {
            expect(messages.length).toEqual(0);
          })
        })
      })
    })
  })
});
