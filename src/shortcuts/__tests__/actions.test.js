/* eslint-env jest */

import { actionById, SHORTCUT_ACTIONS } from '../actions';

describe('acciones de Atajos', () => {
  test('todas las acciones son únicas y ejecutables dentro del simulador', () => {
    const ids = SHORTCUT_ACTIONS.map(action => action.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach(id => expect(actionById(id)).not.toBeNull());
  });

  test('no inventa acciones desconocidas', () => {
    expect(actionById('accion-inexistente')).toBeNull();
  });
});
