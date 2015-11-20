'use babel';
/* eslint-env jasmine */
/* global waitsForPromise */

describe('The eslint provider for Linter', () => {
  const lint = require('../lib/main.js').provideLinter().lint;

  beforeEach(() => {
    atom.workspace.destroyActivePaneItem();
    waitsForPromise(() => {
      return atom.packages.activatePackage('linter-eslint');
    });
  });

  it('should be in the packages list', () => {
    return expect(atom.packages.isPackageLoaded('linter-eslint')).toBe(true);
  });

  it('should be an active package', () => {
    return expect(atom.packages.isPackageActive('linter-eslint')).toBe(true);
  });

  describe('checks bad.js and', () => {
    let editor = null;
    beforeEach(() => {
      waitsForPromise(() => {
        return atom.workspace.open(__dirname + '/files/bad.js').then(openEditor => {
          editor = openEditor;
        });
      });
    });

    it('finds at least one message', () => {
      waitsForPromise(() => {
        return lint(editor).then(messages => {
          expect(messages.length).toEqual(1);
        });
      });
    });

    it('verifies that message', () => {
      waitsForPromise(() => {
        return lint(editor).then(messages => {
          expect(messages[0].type).toBeDefined();
          expect(messages[0].type).toEqual('Error');
          expect(messages[0].text).not.toBeDefined();
          expect(messages[0].html).toBeDefined();
          expect(messages[0].html).toEqual('<span class="badge badge-flexible">' +
            'no-undef</span> &quot;foo&quot; is not defined.');
          expect(messages[0].filePath).toBeDefined();
          expect(messages[0].filePath).toMatch(/.+specs\/files\/bad\.js$/);
          expect(messages[0].range).toBeDefined();
          expect(messages[0].range.length).toEqual(2);
          expect(messages[0].range).toEqual([[0, 0], [0, 8]]);
        });
      });
    });
  });

  it('finds nothing wrong with an empty file', () => {
    waitsForPromise(() => {
      return atom.workspace.open(__dirname + '/files/empty.js').then(editor => {
        return lint(editor).then(messages => {
          expect(messages.length).toEqual(0);
        });
      });
    });
  });

  it('finds nothing wrong with a valid file', () => {
    waitsForPromise(() => {
      return atom.workspace.open(__dirname + '/files/good.js').then(editor => {
        return lint(editor).then(messages => {
          expect(messages.length).toEqual(0);
        });
      });
    });
  });
});
