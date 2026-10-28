const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abrirBanco } = require('../src/persistence/database');
const { operacao } = require('../src/persistence/operacao');
const { instanteLocal } = require('../src/persistence/relogio');
const { mensalidadesDoMes } = require('../src/persistence/mensalidades');
const cliente = { nomeCliente: 'Cliente Teste', telefoneCliente: '41999990000' };
function preparar(t, relogio = '2027-03-15T20:00:00Z') {
  const db = abrirBanco(':memory:');
  t.after(() => db.close());
  let atual = new Date(relogio);
  const s = operacao(db, { agora: () => atual });
  const g = s.gestor();
  g.quadras.push({ ...g.quadras[0], id: 'nova-teste', nome: 'Quadra livre' });
  s.salvarGestor(g);
  return {
    s,
    db,
    avancar: (d) => {
      atual = new Date(d);
    },
  };
}
const erro = (fn, status = 400) => assert.throws(fn, (e) => e.status === status);

test('reserva existente não pode mudar de quadra, horário, data ou tipo pelo PUT', (t) => {
  const { s } = preparar(t);
  const r = s.checkout({
    ...cliente,
    metodo: 'pix',
    itens: [{ quadraId: 'nova-teste', data: '2027-03-16', horario: '10:00' }],
  }).reservas[0];
  for (const alteracao of [
    { data: '2027-03-15', inicio: '08:00', fim: '09:00' },
    { data: '2027-03-17' },
    { quadraId: 1 },
    { tipo: 'bloqueio' },
    { inicio: '11:00', fim: '12:00' },
    { origem: 'WhatsApp' },
  ]) {
    const g = s.gestor();
    Object.assign(
      g.eventos.find((e) => e.id === r.id),
      alteracao
    );
    erro(() => s.salvarGestor(g));
    assert.ok(!s.grade('nova-teste', r.data).horariosLivres.includes('10:00'));
  }
  const g = s.gestor();
  Object.assign(
    g.eventos.find((e) => e.id === r.id),
    {
      status: 'cancelada',
      motivoCancelamento: 'Teste',
      reembolso: 'pendente',
    }
  );
  s.salvarGestor(g);
  assert.ok(s.grade('nova-teste', r.data).horariosLivres.includes('10:00'));
});

test('checkout com preço desatualizado reverte tudo e permite reconfirmar o novo total', (t) => {
  const { s, db } = preparar(t);
  const pedido = {
    ...cliente,
    chave: 'revisao-preco',
    metodo: 'pix',
    totalEsperado: 180,
    itens: [{ quadraId: 'nova-teste', data: '2027-03-16', horario: '10:00' }],
  };
  const g = s.gestor();
  g.regras.push({
    id: 'reajuste',
    quadraId: 'nova-teste',
    tipo: 'data',
    data: '2027-03-16',
    inicio: '10:00',
    fim: '11:00',
    valor: 200,
  });
  s.salvarGestor(g);
  const antes = s.gestor().revisao;
  const pagamentos = db.prepare('SELECT COUNT(*) AS n FROM pagamentos').get().n;
  erro(() => s.checkout(pedido), 409);
  assert.equal(s.gestor().revisao, antes);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pagamentos').get().n, pagamentos);
  assert.ok(s.grade('nova-teste', '2027-03-16').horariosLivres.includes('10:00'));
  const atualizado = { ...pedido, totalEsperado: 200 };
  const r = s.checkout(atualizado);
  assert.equal(r.total, 200);
  assert.deepEqual(s.checkout(atualizado), r);
});
test('fuso de Curitiba não depende do timezone do host, inclusive virada de dia', () => {
  assert.equal(instanteLocal(new Date('2027-03-16T01:30:00Z')), '2027-03-15T22:30:00');
  assert.equal(instanteLocal(new Date('2027-03-16T03:00:00Z')), '2027-03-16T00:00:00');
});
test('buscar horário sem data usa hoje e não ignora disponibilidade', (t) => {
  const { s } = preparar(t);
  assert.equal(s.listarQuadras({ horario: '08:00' }).length, 0);
  assert.ok(s.listarQuadras({ horario: '18:00' }).some((q) => q.id === 'nova-teste'));
});
test('API rejeita reserva passada, início exato e início já transcorrido por segundos', (t) => {
  const { s, avancar } = preparar(t);
  const item = { ...cliente, quadraId: 'nova-teste', data: '2027-03-15' };
  erro(() => s.criarReserva({ ...item, horario: '08:00' }));
  erro(() => s.checkout({ ...cliente, itens: [{ ...item, horario: '17:00' }], metodo: 'pix' }));
  assert.ok(!s.grade('nova-teste', item.data).horariosLivres.includes('17:00'));
  assert.ok(!s.grade('nova-teste', item.data).horariosOcupados.includes('17:00'));
  assert.ok(s.grade('nova-teste', item.data).horariosLivres.includes('18:00'));
  assert.equal(s.criarReserva({ ...item, horario: '18:00' }).status, 'pendente');
  avancar('2027-03-15T21:00:01Z');
  erro(() => s.criarReserva({ ...item, horario: '18:00' }));
});
test('reserva manual e bloqueio não contornam a validação de horário passado', (t) => {
  const { s } = preparar(t);
  for (const tipo of ['avulsa', 'bloqueio']) {
    const g = s.gestor();
    g.eventos.push({
      id: `passado-${tipo}`,
      quadraId: 'nova-teste',
      data: '2027-03-15',
      inicio: '08:00',
      fim: '09:00',
      tipo,
      status: 'confirmada',
      valor: 0,
      cliente: 'Cliente',
      telefone: '41999990000',
    });
    erro(() => s.salvarGestor(g));
    assert.ok(!s.gestor().eventos.some((e) => e.id === `passado-${tipo}`));
  }
});
test('pedido pendente não pode ser pago depois de começar', (t) => {
  const { s, avancar } = preparar(t);
  const r = s.criarReserva({
    ...cliente,
    quadraId: 'nova-teste',
    data: '2027-03-15',
    horario: '18:00',
  });
  avancar('2027-03-15T21:00:00Z');
  erro(() => s.pagar(r.id, 'pix'));
  assert.equal(s.reservas({}).find((e) => e.id === r.id).status, 'pendente');
});
test('filtro por faixa escolhe horários compatíveis antes do menor preço', (t) => {
  const { s } = preparar(t);
  const data = '2027-03-16';
  const g = s.gestor();
  g.regras = [
    {
      id: 'promo80',
      quadraId: 'nova-teste',
      tipo: 'data',
      data,
      inicio: '08:00',
      fim: '09:00',
      valor: 80,
      promocao: true,
    },
    {
      id: 'pico250',
      quadraId: 'nova-teste',
      tipo: 'data',
      data,
      inicio: '20:00',
      fim: '21:00',
      valor: 250,
    },
  ];
  s.salvarGestor(g);
  const buscar = (f) =>
    s.listarQuadras({ data, esporte: 'society', ...f }).find((q) => q.id === 'nova-teste');
  assert.equal(buscar({ precoMin: 100, precoMax: 200 }).precoBuscado, 180);
  assert.ok(!buscar({ precoMin: 100, precoMax: 200 }).horariosCompativeis.includes('08:00'));
  assert.ok(!buscar({ precoMin: 100, precoMax: 200 }).horariosCompativeis.includes('20:00'));
  assert.equal(buscar({ precoMin: 0, precoMax: 100 }).precoBuscado, 80);
  assert.equal(buscar({ precoMin: 100, horario: '08:00' }), undefined);
  assert.equal(buscar({ precoMin: 100, precoMax: 200, horario: '09:00' }).precoBuscado, 180);
  assert.equal(buscar({ precoMin: 300 }), undefined);
  erro(() => buscar({ precoMin: 200, precoMax: 100 }));
  const r = s.checkout({
    ...cliente,
    itens: [{ quadraId: 'nova-teste', data, horario: '09:00' }],
    metodo: 'pix',
  });
  assert.equal(r.total, 180);
});
test('consolidar mensalidades preserva contratos distintos e aplica reajuste no próximo mês', () => {
  const a = {
    id: 'a',
    contratoId: 'contrato',
    quadraId: 1,
    cliente: 'Mesmo grupo',
    de: '2027-03-01',
    ate: '2027-03-14',
    valorMensal: 1200,
    pagamento: 'pago',
  };
  const b = {
    ...a,
    id: 'b',
    de: '2027-03-15',
    ate: '2027-05-31',
    valorMensal: 1500,
    pagamento: 'pendente',
  };
  const c = { ...a, id: 'c', contratoId: 'outro-contrato', ate: '2027-05-31' };
  const marco = mensalidadesDoMes([b, a, c], '2027-03-28');
  assert.equal(marco.length, 2);
  assert.equal(marco.find((m) => m.contratoId === 'contrato').valor, 120000);
  assert.equal(marco.find((m) => m.contratoId === 'contrato').status, 'paga');
  assert.equal(mensalidadesDoMes([a, b], '2027-04-15')[0].valor, 150000);
  assert.equal(mensalidadesDoMes([a, b], '2027-06-01').length, 0);
});
test('editar recorrência persiste linhagem e retorna uma mensalidade por contrato na API', (t) => {
  const { s } = preparar(t);
  let g = s.gestor();
  g.mensalistas.push({
    id: 'origem',
    quadraId: 'nova-teste',
    cliente: 'Grupo',
    telefone: '41999990000',
    de: '2027-03-01',
    ate: '2027-05-31',
    dia: 1,
    inicio: '10:00',
    fim: '11:00',
    valorMensal: 1200,
    pagamento: 'pago',
  });
  s.salvarGestor(g);
  g = s.gestor();
  const anterior = g.mensalistas.find((m) => m.id === 'origem');
  anterior.ate = '2027-03-14';
  g.mensalistas.push({
    ...anterior,
    id: 'versao-2',
    versaoAnteriorId: 'origem',
    de: '2027-03-15',
    ate: '2027-05-31',
    inicio: '11:00',
    fim: '12:00',
  });
  s.salvarGestor(g);
  const f = s.gestor().mensalidades.filter((m) => m.contratoId === 'origem');
  assert.equal(f.length, 1);
  assert.equal(f[0].valor, 120000);
  assert.ok(s.grade('nova-teste', '2027-03-22').horariosOcupados.includes('11:00'));
  assert.ok(s.grade('nova-teste', '2027-03-22').horariosLivres.includes('10:00'));
});
test('pagamento rejeita bloqueio e reserva já marcada como recebida pelo gestor', (t) => {
  const { s } = preparar(t);
  const g = s.gestor();
  g.eventos.push({
    id: 'bloqueio-pagamento',
    quadraId: 'nova-teste',
    data: '2027-03-16',
    inicio: '08:00',
    fim: '09:00',
    tipo: 'bloqueio',
    status: 'confirmada',
    valor: 0,
  });
  g.eventos.push({
    id: 'manual-paga',
    quadraId: 'nova-teste',
    data: '2027-03-16',
    inicio: '09:00',
    fim: '10:00',
    tipo: 'avulsa',
    origem: 'WhatsApp',
    status: 'confirmada',
    pagamento: 'pago',
    valor: 180,
    cliente: 'Cliente',
    telefone: '41999990000',
  });
  s.salvarGestor(g);
  erro(() => s.pagar('bloqueio-pagamento', 'pix'));
  erro(() => s.pagar('manual-paga', 'pix'), 409);
  for (const itens of [[null], [{}], [[]]])
    erro(() => s.checkout({ ...cliente, itens, metodo: 'pix' }));
});
