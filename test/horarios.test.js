const { test } = require('node:test');
const assert = require('node:assert/strict');
const quadraService = require('../src/services/quadraService');
const reservaService = require('../src/services/reservaService');

const CAMPO_DO_BACACHERI = 3; // funciona das 07:00 às 18:00

function dadosDeReserva(sobrescritas = {}) {
  return {
    quadraId: CAMPO_DO_BACACHERI,
    nomeCliente: 'Cliente de Teste',
    telefoneCliente: '41999999999',
    data: '2099-12-01',
    horario: '17:00',
    ...sobrescritas,
  };
}

test('grade de horários só mostra horários dentro do funcionamento da quadra', () => {
  const { horariosLivres } = quadraService.montarGradeDeHorarios(CAMPO_DO_BACACHERI, '2099-12-01');

  assert.equal(horariosLivres[0], '07:00');
  assert.equal(horariosLivres.at(-1), '17:00');
  assert.ok(!horariosLivres.includes('18:00'));
});

test('quadra que abre às 08:00 não oferece o horário das 07:00', () => {
  const { horariosLivres } = quadraService.montarGradeDeHorarios(1, '2099-12-01');

  assert.equal(horariosLivres[0], '08:00');
});

test('aceita reserva cuja última hora termina no fechamento', () => {
  assert.deepEqual(reservaService.validarDadosDeReserva(dadosDeReserva()), []);
});

test('rejeita reserva fora do horário de funcionamento', () => {
  const erros = reservaService.validarDadosDeReserva(dadosDeReserva({ horario: '20:00' }));

  assert.match(erros.join(' '), /fora do horário de funcionamento/);
});
