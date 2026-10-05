const { test } = require('node:test');
const assert = require('node:assert/strict');
const reservaController = require('../src/controllers/reservaController');

function cancelar(reservaId) {
  const resposta = {};
  resposta.status = (codigo) => {
    resposta.codigo = codigo;
    return resposta;
  };
  resposta.json = (corpo) => {
    resposta.corpo = corpo;
    return resposta;
  };

  reservaController.cancelarReserva({ params: { id: reservaId } }, resposta);
  return resposta;
}

test('cancela uma reserva ativa', () => {
  const resposta = cancelar(2);

  assert.equal(resposta.codigo, 200);
  assert.equal(resposta.corpo.status, 'cancelada');
});

test('não cancela de novo uma reserva já cancelada', () => {
  const resposta = cancelar(2);

  assert.equal(resposta.codigo, 400);
  assert.match(resposta.corpo.error, /já está cancelada/);
});

test('retorna 404 para reserva inexistente', () => {
  assert.equal(cancelar(999).codigo, 404);
});
