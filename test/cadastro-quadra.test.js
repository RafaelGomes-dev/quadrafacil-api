const { test } = require('node:test');
const assert = require('node:assert/strict');
const quadraService = require('../src/services/quadraService');

function dadosDeQuadra(sobrescritas = {}) {
  return {
    nome: 'Arena Teste',
    endereco: 'Rua Exemplo, 123',
    cidade: 'Curitiba',
    esporte: 'society',
    precoHora: 150,
    ...sobrescritas,
  };
}

test('aceita quadra sem horário de funcionamento e usa o padrão', () => {
  assert.deepEqual(quadraService.validarDadosDeQuadra(dadosDeQuadra()), []);

  const quadra = quadraService.cadastrarQuadra(dadosDeQuadra());
  assert.deepEqual(quadra.horarioFuncionamento, { abertura: '08:00', fechamento: '22:00' });
});

test('aceita horário de funcionamento válido', () => {
  const horarioFuncionamento = { abertura: '07:00', fechamento: '23:30' };

  assert.deepEqual(quadraService.validarDadosDeQuadra(dadosDeQuadra({ horarioFuncionamento })), []);
});

test('rejeita horário de funcionamento fora do formato HH:mm', () => {
  const erros = quadraService.validarDadosDeQuadra(
    dadosDeQuadra({ horarioFuncionamento: { abertura: '8h', fechamento: '22:00' } })
  );

  assert.match(erros.join(' '), /formato HH:mm/);
});

test('rejeita fechamento antes ou igual à abertura', () => {
  const erros = quadraService.validarDadosDeQuadra(
    dadosDeQuadra({ horarioFuncionamento: { abertura: '22:00', fechamento: '08:00' } })
  );

  assert.match(erros.join(' '), /fechamento precisa ser depois da abertura/);
});
