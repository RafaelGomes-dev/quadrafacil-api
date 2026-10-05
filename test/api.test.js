const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

let servidor;
let urlBase;

before(
  () =>
    new Promise((resolve) => {
      servidor = app.listen(0, '127.0.0.1', () => {
        urlBase = `http://127.0.0.1:${servidor.address().port}/api`;
        resolve();
      });
    })
);

after(
  () =>
    new Promise((resolve, reject) => {
      servidor.close((erro) => (erro ? reject(erro) : resolve()));
    })
);

async function requisicao(caminho, opcoes = {}) {
  const resposta = await fetch(`${urlBase}${caminho}`, {
    ...opcoes,
    headers: {
      'content-type': 'application/json',
      ...opcoes.headers,
    },
  });

  return { status: resposta.status, corpo: await resposta.json() };
}

test('retorna status da API', async () => {
  const resposta = await requisicao('/health');

  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.corpo, { status: 'API running!' });
});

test('retorna erro para rota inexistente', async () => {
  const resposta = await requisicao('/rota-inexistente');

  assert.equal(resposta.status, 404);
  assert.deepEqual(resposta.corpo, { error: 'Rota não encontrada' });
});

test('lista quadras cadastradas', async () => {
  const resposta = await requisicao('/quadras');

  assert.equal(resposta.status, 200);
  assert.ok(Array.isArray(resposta.corpo));
  assert.ok(resposta.corpo.some((quadra) => quadra.id === 1));
});

test('filtra quadras por bairro sem acento, esporte e preço máximo', async () => {
  const resposta = await requisicao(
    '/quadras?bairro=agua%20verde&esporte=beach%20tennis&precoMax=100'
  );

  assert.equal(resposta.status, 200);
  assert.equal(resposta.corpo.length, 1);
  assert.equal(resposta.corpo[0].id, 4);
  assert.equal(resposta.corpo[0].nome, 'Beach Sports Água Verde');
});

test('consulta quadra por id e retorna erro quando não existe', async () => {
  const quadra = await requisicao('/quadras/1');

  assert.equal(quadra.status, 200);
  assert.equal(quadra.corpo.id, 1);

  const inexistente = await requisicao('/quadras/999');

  assert.equal(inexistente.status, 404);
  assert.deepEqual(inexistente.corpo, { error: 'Quadra não encontrada.' });
});

test('cadastra uma quadra valida', async () => {
  const dados = {
    nome: 'Centro Esportivo Portao Tenis',
    endereco: 'Rua Professor Joao Doetzer, 450',
    cidade: 'Curitiba',
    bairro: 'Portao',
    esporte: 'tenis',
    precoHora: 110,
  };

  const resposta = await requisicao('/quadras', {
    method: 'POST',
    body: JSON.stringify(dados),
  });

  assert.equal(resposta.status, 201);
  assert.equal(typeof resposta.corpo.id, 'number');
  assert.equal(resposta.corpo.nome, dados.nome);
  assert.equal(resposta.corpo.cidade, dados.cidade);
  assert.equal(resposta.corpo.esporte, dados.esporte);
  assert.equal(resposta.corpo.precoHora, dados.precoHora);
});

test('rejeita cadastro de quadra sem campo obrigatorio', async () => {
  const resposta = await requisicao('/quadras', {
    method: 'POST',
    body: JSON.stringify({
      endereco: 'Rua Teste, 100',
      cidade: 'Curitiba',
      esporte: 'tenis',
      precoHora: 80,
    }),
  });

  assert.equal(resposta.status, 400);
  assert.equal(resposta.corpo.error, 'Dados inválidos.');
  assert.ok(resposta.corpo.detalhes.some((detalhe) => detalhe.includes('"nome"')));
});

test('rejeita cadastro de quadra com preco invalido', async () => {
  const resposta = await requisicao('/quadras', {
    method: 'POST',
    body: JSON.stringify({
      nome: 'Quadra Teste Preco Invalido',
      endereco: 'Rua Teste, 200',
      cidade: 'Curitiba',
      esporte: 'tenis',
      precoHora: 0,
    }),
  });

  assert.equal(resposta.status, 400);
  assert.ok(resposta.corpo.detalhes.some((detalhe) => detalhe.includes('maior que zero')));
});

function dadosDeReserva(sobrescritas = {}) {
  return {
    quadraId: 1,
    nomeCliente: 'Cliente de Teste',
    telefoneCliente: '(41) 99999-9999',
    data: '2099-12-20',
    horario: '19:00',
    ...sobrescritas,
  };
}

test('rejeita data inexistente, data passada e horário fora da grade', async () => {
  const cenarios = [
    { dados: { data: '2099-02-30' }, detalhe: 'formato AAAA-MM-DD' },
    { dados: { data: '2020-01-01' }, detalhe: 'data que já passou' },
    { dados: { horario: '19:30' }, detalhe: 'horário disponível da grade' },
  ];

  for (const cenario of cenarios) {
    const resposta = await requisicao('/reservas', {
      method: 'POST',
      body: JSON.stringify(dadosDeReserva(cenario.dados)),
    });

    assert.equal(resposta.status, 400);
    assert.ok(resposta.corpo.detalhes.some((detalhe) => detalhe.includes(cenario.detalhe)));
  }
});

test('bloqueia conflito e libera o horário depois do cancelamento', async () => {
  const dados = dadosDeReserva({ data: '2099-12-21' });
  const primeira = await requisicao('/reservas', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  assert.equal(primeira.status, 201);

  const conflito = await requisicao('/reservas', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  assert.equal(conflito.status, 409);

  const cancelamento = await requisicao(`/reservas/${primeira.corpo.id}/cancelar`, {
    method: 'PATCH',
  });
  assert.equal(cancelamento.status, 200);
  assert.equal(cancelamento.corpo.status, 'cancelada');

  const depoisDoCancelamento = await requisicao('/reservas', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  assert.equal(depoisDoCancelamento.status, 201);
});

test('aprova um pagamento e rejeita uma segunda cobrança da mesma reserva', async () => {
  const reserva = await requisicao('/reservas', {
    method: 'POST',
    body: JSON.stringify(dadosDeReserva({ data: '2099-12-22' })),
  });
  assert.equal(reserva.status, 201);

  const dadosDoPagamento = { reservaId: reserva.corpo.id, metodo: 'pix' };
  const primeiroPagamento = await requisicao('/pagamentos', {
    method: 'POST',
    body: JSON.stringify(dadosDoPagamento),
  });
  assert.equal(primeiroPagamento.status, 201);

  const pagamentoDuplicado = await requisicao('/pagamentos', {
    method: 'POST',
    body: JSON.stringify(dadosDoPagamento),
  });
  assert.equal(pagamentoDuplicado.status, 409);
  assert.equal(pagamentoDuplicado.corpo.pagamentoId, primeiroPagamento.corpo.id);
});
