const { randomUUID } = require('node:crypto');
const { transacao } = require('./database');
const { instanteLocal } = require('./relogio');
const { mensalidadesDoMes } = require('./mensalidades');

class ErroOperacao extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const exigir = (condicao, mensagem, status = 400) => {
  if (!condicao) throw new ErroOperacao(status, mensagem);
};
const json = JSON.stringify;
const dataValida = (d) =>
  typeof d === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  !Number.isNaN(Date.parse(d)) &&
  new Date(d).toISOString().slice(0, 10) === d;
const minutos = (h) =>
  typeof h === 'string' && /^([01]\d|2[0-3]):(00|30)$/.test(h)
    ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3))
    : NaN;
const hora = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const proximoDia = (d) => new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);
const diaSemana = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function operacao(db, { agora = () => new Date() } = {}) {
  const hoje = () => instanteLocal(agora()).slice(0, 10);
  const inicioFuturo = (data, horario) => `${data}T${horario}:00` > instanteLocal(agora());
  const todos = (table) =>
    db
      .prepare(`SELECT dados FROM ${table}`)
      .all()
      .map((r) => JSON.parse(r.dados));
  const buscar = (table, id) => {
    const r = db.prepare(`SELECT dados FROM ${table} WHERE id=?`).get(String(id));
    return r && JSON.parse(r.dados);
  };
  const meta = (key) => {
    const r = db.prepare('SELECT dados FROM metadados WHERE chave=?').get(key);
    return r && JSON.parse(r.dados);
  };
  const setMeta = (key, value) =>
    db.prepare('INSERT OR REPLACE INTO metadados VALUES(?,?)').run(key, json(value));
  const salvarEstab = (e) =>
    db
      .prepare(
        'INSERT INTO estabelecimentos VALUES(?,?) ON CONFLICT(id) DO UPDATE SET dados=excluded.dados'
      )
      .run(String(e.id), json(e));
  const salvarQuadra = (q) =>
    db
      .prepare(
        'INSERT INTO quadras VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET estabelecimento_id=excluded.estabelecimento_id,dados=excluded.dados'
      )
      .run(String(q.id), q.estabelecimentoId, json(q));
  const salvarFilho = (table, e) =>
    db
      .prepare(
        `INSERT INTO ${table} VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET quadra_id=excluded.quadra_id,dados=excluded.dados`
      )
      .run(String(e.id), String(e.quadraId), json(e));
  const revisao = () => meta('revisao') || 0;
  const incrementar = () => setMeta('revisao', revisao() + 1);
  function contaEstab(id) {
    return todos('gestores').find((c) => c.estabelecimentoId === id);
  }
  function ativa(q) {
    return q && q.ativa !== false && contaEstab(q.estabelecimentoId)?.status !== 'revogada';
  }
  function conferirAtiva(q) {
    exigir(q, 'Quadra não encontrada.', 404);
    exigir(ativa(q), 'Quadra indisponível ou gestor revogado.', 403);
  }
  function intervalo(e, q) {
    exigir(q, 'Quadra não encontrada.', 404);
    const a = minutos(e.inicio),
      b = minutos(e.fim);
    exigir(Number.isFinite(a) && Number.isFinite(b) && b > a, 'Intervalo de horário inválido.');
    exigir(
      a >= minutos(q.horarioFuncionamento.abertura) &&
        b <= minutos(q.horarioFuncionamento.fechamento),
      'Horário fora do funcionamento da quadra.'
    );
  }
  function ocupar(e, data = e.data) {
    for (let m = minutos(e.inicio); m < minutos(e.fim); m += 30) {
      const existente = db
        .prepare('SELECT origem_id FROM ocupacoes WHERE quadra_id=? AND data=? AND minuto=?')
        .get(String(e.quadraId), data, m);
      exigir(
        !existente,
        `Já existe reserva, mensalista ou bloqueio em ${data} às ${hora(m)}.`,
        409
      );
      db.prepare('INSERT INTO ocupacoes VALUES(?,?,?,?)').run(
        String(e.quadraId),
        data,
        m,
        String(e.id)
      );
    }
  }
  function reconstruirOcupacao() {
    db.exec('DELETE FROM ocupacoes');
    for (const e of todos('eventos')) if (e.status !== 'cancelada') ocupar(e);
    for (const m of todos('mensalistas')) {
      for (let d = m.de; d <= m.ate; d = proximoDia(d))
        if (diaSemana(d) === Number(m.dia) && !m.excecoes?.includes(d)) ocupar(m, d);
    }
  }
  function seed() {
    if (meta('seed')) return;
    const base = require('../data/seed.json');
    transacao(db, () => {
      const g = base.gestor;
      salvarEstab(g.estabelecimento);
      for (const q of [
        ...g.quadras.map((q) => ({ ...q, estabelecimentoId: g.estabelecimento.id })),
        ...base.outrasQuadras,
      ]) {
        const e = buscar('estabelecimentos', q.estabelecimentoId);
        if (!e)
          salvarEstab({
            id: q.estabelecimentoId,
            nome: q.estabelecimentoNome || q.nome,
            endereco: q.endereco,
            bairro: q.bairro,
            cidade: q.cidade,
          });
        salvarQuadra(q);
      }
      for (const c of base.admin.contas) {
        const id =
          c.id === 'gestor-arena-batel'
            ? 'arena-batel'
            : c.id === 'gestor-cic'
              ? 'quadra-7'
              : c.id === 'gestor-campo'
                ? 'quadra-3'
                : `catalogo-${c.id}`;
        if (!buscar('estabelecimentos', id))
          salvarEstab({ id, nome: c.estabelecimento, cidade: 'Curitiba' });
        const conta = { ...c, estabelecimentoId: id };
        db.prepare('INSERT INTO gestores VALUES(?,?,?,?)').run(c.id, c.email, id, json(conta));
      }
      // Ocupações recorrentes primeiro; exemplos conflitantes são descartados no seed.
      for (const m of g.mensalistas) salvarFilho('mensalistas', m);
      reconstruirOcupacao();
      for (const e of g.eventos) {
        try {
          transacaoSeed(e);
        } catch (error) {
          if (error.status !== 409) throw error;
        }
      }
      for (const r of g.regras) salvarFilho('regras', r);
      setMeta('admin', { historico: [], versaoExemplos: 2 });
      setMeta('seed', 1);
      setMeta('revisao', 1);
    });
  }
  function transacaoSeed(e) {
    db.exec('SAVEPOINT seed_evento');
    try {
      ocupar(e);
      salvarFilho('eventos', e);
      db.exec('RELEASE seed_evento');
    } catch (error) {
      db.exec('ROLLBACK TO seed_evento; RELEASE seed_evento');
      throw error;
    }
  }
  function quadras() {
    return todos('quadras')
      .filter(ativa)
      .map((q) => {
        const e = buscar('estabelecimentos', q.estabelecimentoId);
        return {
          ...q,
          endereco: e.endereco,
          bairro: e.bairro,
          cidade: e.cidade,
          estabelecimentoNome: e.nome,
          patrocinado: Boolean(contaEstab(e.id)?.patrocinado),
          regras: todos('regras').filter((r) => String(r.quadraId) === String(q.id)),
        };
      });
  }
  function cotacao(q, data, h) {
    const regras = todos('regras').filter(
      (r) =>
        String(r.quadraId) === String(q.id) &&
        minutos(h) >= minutos(r.inicio) &&
        minutos(h) < minutos(r.fim) &&
        (r.tipo === 'data' ? r.data === data : Number(r.dia) === diaSemana(data))
    );
    const r = regras.filter((r) => r.tipo === 'data').at(-1) || regras.at(-1);
    return {
      valor: Number(r?.valor ?? q.precoHora),
      promocao: Boolean(r?.promocao),
      rotulo: r?.nome,
    };
  }
  function grade(id, data) {
    exigir(dataValida(data), 'Informe uma data válida (AAAA-MM-DD).');
    const q = buscar('quadras', id);
    conferirAtiva(q);
    const livres = [],
      ocupados = [],
      precos = {};
    for (
      let m = minutos(q.horarioFuncionamento.abertura);
      m + 60 <= minutos(q.horarioFuncionamento.fechamento);
      m += 60
    ) {
      const h = hora(m);
      if (!inicioFuturo(data, h)) continue;
      const busy = db
        .prepare(
          'SELECT 1 FROM ocupacoes WHERE quadra_id=? AND data=? AND minuto>=? AND minuto<? LIMIT 1'
        )
        .get(String(id), data, m, m + 60);
      (busy ? ocupados : livres).push(h);
      precos[h] = cotacao(q, data, h);
    }
    return { horariosLivres: livres, horariosOcupados: ocupados, precos };
  }
  function listarQuadras(f = {}) {
    // Horário sem data corresponde a hoje em Curitiba, nunca a um filtro ignorado.
    if (f.horario && !f.data) f = { ...f, data: hoje() };
    const compativelPreco = (valor) =>
      (f.precoMin === undefined || f.precoMin === '' || valor >= Number(f.precoMin)) &&
      (f.precoMax === undefined || f.precoMax === '' || valor <= Number(f.precoMax));
    for (const campo of ['precoMin', 'precoMax'])
      if (f[campo] !== undefined && f[campo] !== '')
        exigir(
          Number.isFinite(Number(f[campo])) && Number(f[campo]) >= 0,
          'Filtro de preço inválido.'
        );
    if (f.data) exigir(dataValida(f.data), 'Data inválida.');
    if (
      f.precoMin !== undefined &&
      f.precoMax !== undefined &&
      f.precoMin !== '' &&
      f.precoMax !== ''
    )
      exigir(Number(f.precoMin) <= Number(f.precoMax), 'O preço mínimo não pode superar o máximo.');
    if (f.horario) exigir(Number.isFinite(minutos(f.horario)), 'Horário inválido.');
    return quadras()
      .filter(
        (q) =>
          ['cidade', 'bairro', 'esporte'].every(
            (k) => !f[k] || normalizar(q[k]).includes(normalizar(f[k]))
          ) &&
          (!f.coberta || String(q.estrutura.coberta) === String(f.coberta))
      )
      .map((q) => {
        if (!f.data) return q;
        const g = grade(q.id, f.data),
          hs = f.horario ? [f.horario] : g.horariosLivres;
        const horariosCompativeis = hs
          .filter((h) => g.horariosLivres.includes(h))
          .filter((h) => compativelPreco(cotacao(q, f.data, h).valor));
        const precos = horariosCompativeis.map((h) => cotacao(q, f.data, h));
        const c = precos.sort((a, b) => a.valor - b.valor)[0];
        return c
          ? {
              ...q,
              precoBuscado: c.valor,
              promocao: c.promocao,
              rotuloPromocao: c.rotulo,
              precoAPartirDe: !f.horario,
              horariosCompativeis,
            }
          : null;
      })
      .filter(
        (q) =>
          q &&
          (!f.precoMin || (q.precoBuscado ?? q.precoHora) >= Number(f.precoMin)) &&
          (!f.precoMax || (q.precoBuscado ?? q.precoHora) <= Number(f.precoMax))
      );
  }
  function criar(d) {
    const q = buscar('quadras', d.quadraId);
    conferirAtiva(q);
    exigir(
      dataValida(d.data) && d.data >= hoje(),
      'Escolha uma data válida que não esteja no passado.'
    );
    exigir(Number.isFinite(minutos(d.horario)), 'Horário inválido.');
    exigir(inicioFuturo(d.data, d.horario), 'Este horário já começou. Escolha um horário futuro.');
    const nome = String(d.nomeCliente || '').trim(),
      telefone = String(d.telefoneCliente || '').replace(/\D/g, '');
    exigir(nome.length >= 3 && /^\d{10,11}$/.test(telefone), 'Informe nome e telefone com DDD.');
    exigir(
      grade(q.id, d.data).horariosLivres.includes(d.horario),
      'Este horário já está reservado ou está fora da grade.',
      409
    );
    const e = {
      id: randomUUID(),
      quadraId: q.id,
      data: d.data,
      inicio: d.horario,
      fim: hora(minutos(d.horario) + 60),
      tipo: 'avulsa',
      cliente: nome,
      telefone,
      origem: 'QuadraFácil',
      metodo: 'online',
      pagamento: 'pendente',
      status: 'pendente',
      valor: cotacao(q, d.data, d.horario).valor,
      criadaEm: new Date().toISOString(),
    };
    ocupar(e);
    salvarFilho('eventos', e);
    return e;
  }
  function comoReserva(e) {
    return {
      ...e,
      nomeCliente: e.cliente,
      telefoneCliente: e.telefone,
      horario: e.inicio,
      valorTotal: e.valor,
      metodoPagamento: e.metodo,
    };
  }
  function pagar(id, metodo) {
    exigir(['pix', 'cartao'].includes(metodo), 'Selecione Pix ou cartão.');
    const e = buscar('eventos', id);
    exigir(e, 'Reserva não encontrada.', 404);
    exigir(e.tipo === 'avulsa', 'Somente reservas avulsas podem receber pagamento por esta rota.');
    exigir(e.status !== 'cancelada', 'Não é possível pagar uma reserva cancelada.');
    exigir(e.pagamento !== 'pago', 'Esta reserva já está paga.', 409);
    exigir(
      e.origem !== 'QuadraFácil' || inicioFuturo(e.data, e.inicio),
      'O horário desta reserva já começou.'
    );
    exigir(
      !db.prepare('SELECT 1 FROM pagamentos WHERE reserva_id=?').get(String(id)),
      'Esta reserva já possui um pagamento aprovado.',
      409
    );
    conferirAtiva(buscar('quadras', e.quadraId));
    const p = {
      id: randomUUID(),
      reservaId: id,
      metodo,
      valor: e.valor,
      status: 'aprovado',
      simulado: true,
      criadaEm: new Date().toISOString(),
    };
    db.prepare('INSERT INTO pagamentos VALUES(?,?,?)').run(p.id, String(id), json(p));
    salvarFilho('eventos', { ...e, pagamento: 'pago', status: 'confirmada', metodo });
    return p;
  }
  function gestor() {
    const qs = todos('quadras').filter((q) => q.estabelecimentoId === 'arena-batel');
    const ids = new Set(qs.map((q) => String(q.id)));
    const mensalistas = todos('mensalistas')
      .filter((e) => ids.has(String(e.quadraId)))
      .map((m) => ({ ...m, contratoId: m.contratoId || m.id }));
    return {
      estabelecimento: buscar('estabelecimentos', 'arena-batel'),
      quadras: qs,
      eventos: todos('eventos').filter((e) => ids.has(String(e.quadraId))),
      regras: todos('regras').filter((e) => ids.has(String(e.quadraId))),
      mensalistas,
      mensalidades: mensalidadesDoMes(mensalistas, hoje()),
      revisao: revisao(),
    };
  }
  function validarEstado(s) {
    exigir(
      s &&
        Array.isArray(s.quadras) &&
        Array.isArray(s.eventos) &&
        Array.isArray(s.regras) &&
        Array.isArray(s.mensalistas),
      'Estado inválido.'
    );
    for (const table of ['quadras', 'eventos', 'regras', 'mensalistas'])
      exigir(
        s[table].every(
          (e) =>
            e && (typeof e.id === 'string' || typeof e.id === 'number') && String(e.id).length > 0
        ),
        'Registro inválido.'
      );
    exigir(
      new Set(s.quadras.map((q) => String(q.id))).size === s.quadras.length,
      'Quadras duplicadas.'
    );
    exigir(
      s.estabelecimento?.id === 'arena-batel' && String(s.estabelecimento.nome || '').trim(),
      'Estabelecimento inválido.'
    );
    const conta = contaEstab('arena-batel');
    exigir(conta?.status === 'ativa', 'Acesso revogado.', 403);
    const anteriores = gestor();
    exigir(
      s.quadras.length <= conta.limite || s.quadras.length <= anteriores.quadras.length,
      'Limite de quadras atingido.'
    );
    exigir(
      anteriores.quadras.every((q) => s.quadras.some((n) => String(n.id) === String(q.id))),
      'Pause a quadra em vez de excluir seu histórico.'
    );
    for (const q of s.quadras) {
      exigir(
        q.estrutura && typeof q.estrutura.coberta === 'boolean' && Array.isArray(q.fotos),
        'Estrutura e fotos inválidas.'
      );
      const antiga = buscar('quadras', q.id);
      exigir(
        !antiga || antiga.estabelecimentoId === 'arena-batel',
        'Quadra pertence a outro estabelecimento.',
        403
      );
      exigir(
        String(q.nome || '').trim() && Number.isFinite(q.precoHora) && q.precoHora > 0,
        'Nome e preço da quadra inválidos.'
      );
      exigir(
        Number.isFinite(minutos(q.horarioFuncionamento?.abertura)) &&
          minutos(q.horarioFuncionamento?.fechamento) > minutos(q.horarioFuncionamento?.abertura),
        'Funcionamento inválido.'
      );
    }
    for (const table of ['eventos', 'regras', 'mensalistas']) {
      exigir(
        new Set(s[table].map((e) => String(e.id))).size === s[table].length,
        'Identificadores duplicados.'
      );
      for (const e of s[table]) {
        const antigo = buscar(table, e.id);
        exigir(
          !antigo || anteriores[table].some((a) => String(a.id) === String(e.id)),
          'Registro pertence a outro estabelecimento.',
          403
        );
        const q = s.quadras.find((q) => String(q.id) === String(e.quadraId));
        intervalo(e, q);
        if (table === 'eventos') {
          if (!antigo && e.status !== 'cancelada' && e.tipo !== 'mensalista')
            exigir(
              inicioFuturo(e.data, e.inicio),
              'Não é possível criar uma reserva ou bloqueio em horário passado.'
            );
          exigir(
            dataValida(e.data) &&
              ['avulsa', 'bloqueio', 'mensalista'].includes(e.tipo) &&
              ['confirmada', 'pendente', 'cancelada'].includes(e.status),
            'Evento inválido.'
          );
          exigir(Number.isFinite(e.valor) && e.valor >= 0, 'Valor inválido.');
          if (antigo) exigir(antigo.valor === e.valor, 'O valor contratado não pode ser alterado.');
          if (!antigo && e.tipo === 'avulsa') {
            exigir(
              String(e.cliente || '').trim().length >= 3 &&
                /^\d{10,11}$/.test(String(e.telefone || '').replace(/\D/g, '')),
              'Informe cliente e telefone com DDD.'
            );
            let valor = 0;
            for (let m = minutos(e.inicio); m < minutos(e.fim); m += 60)
              valor += (cotacao(q, e.data, hora(m)).valor * Math.min(60, minutos(e.fim) - m)) / 60;
            e.valor = Math.round(valor * 100) / 100;
          }
        } else if (table === 'mensalistas') {
          const contratoAnterior = antigo?.contratoId || antigo?.id;
          if (antigo)
            exigir(
              !e.contratoId || e.contratoId === contratoAnterior,
              'O contrato da recorrência não pode ser alterado.'
            );
          else if (e.contratoId && e.contratoId !== e.id) {
            const anterior = buscar('mensalistas', e.versaoAnteriorId);
            exigir(
              anterior &&
                (anterior.contratoId || anterior.id) === e.contratoId &&
                anteriores.mensalistas.some((m) => m.id === anterior.id),
              'Origem da alteração de recorrência inválida.'
            );
          }
          e.contratoId = contratoAnterior || e.contratoId || e.id;
          exigir(
            dataValida(e.de) &&
              dataValida(e.ate) &&
              e.ate >= e.de &&
              Date.parse(e.ate) - Date.parse(e.de) <= 366 * 86400000,
            'Vigência inválida; máximo de um ano.'
          );
          exigir(
            Number.isInteger(Number(e.dia)) &&
              Number(e.dia) >= 0 &&
              Number(e.dia) <= 6 &&
              Number.isFinite(e.valorMensal) &&
              e.valorMensal > 0,
            'Mensalista inválido.'
          );
          exigir(
            !e.excecoes || (Array.isArray(e.excecoes) && e.excecoes.every(dataValida)),
            'Exceções inválidas.'
          );
        } else
          exigir(
            Number.isFinite(e.valor) &&
              e.valor > 0 &&
              ['data', 'semanal'].includes(e.tipo) &&
              (e.tipo === 'data'
                ? dataValida(e.data)
                : Number.isInteger(Number(e.dia)) && Number(e.dia) >= 0 && Number(e.dia) <= 6),
            'Regra de preço inválida.'
          );
      }
    }
    exigir(
      anteriores.eventos.every((e) => s.eventos.some((n) => String(n.id) === String(e.id))),
      'Cancele reservas em vez de excluir o histórico.'
    );
    for (const [i, m] of s.mensalistas.entries())
      exigir(
        !s.mensalistas
          .slice(i + 1)
          .some((n) => n.contratoId === m.contratoId && m.de <= n.ate && n.de <= m.ate),
        'Versões do mesmo contrato não podem ter vigências sobrepostas.'
      );
  }
  function salvarGestor(s) {
    return transacao(db, () => {
      exigir(
        s.revisao === revisao(),
        'A agenda foi atualizada por outra operação. Recarregue e tente novamente.',
        409
      );
      validarEstado(s);
      salvarEstab(s.estabelecimento);
      for (const q of s.quadras) salvarQuadra({ ...q, estabelecimentoId: 'arena-batel' });
      for (const table of ['eventos', 'regras', 'mensalistas']) {
        if (table !== 'eventos')
          for (const e of gestor()[table])
            db.prepare(`DELETE FROM ${table} WHERE id=?`).run(String(e.id));
        for (const e of s[table]) salvarFilho(table, e);
      }
      reconstruirOcupacao();
      incrementar();
      return gestor();
    });
  }
  function admin() {
    return {
      ...meta('admin'),
      contas: todos('gestores').map((c) => ({
        ...c,
        quadras: todos('quadras').filter((q) => q.estabelecimentoId === c.estabelecimentoId).length,
      })),
      revisao: revisao(),
    };
  }
  function salvarAdmin(s) {
    return transacao(db, () => {
      exigir(
        s.revisao === revisao(),
        'Dados atualizados por outra operação. Recarregue e tente novamente.',
        409
      );
      exigir(Array.isArray(s.contas) && s.contas.length <= 200, 'Contas inválidas.');
      exigir(
        s.contas.every((c) => c && typeof c.id === 'string' && c.id.length > 0),
        'Conta inválida.'
      );
      exigir(Array.isArray(s.historico), 'Histórico inválido.');
      exigir(
        todos('gestores').every((c) => s.contas.some((n) => n.id === c.id)),
        'Revogue contas em vez de excluir o histórico.'
      );
      exigir(new Set(s.contas.map((c) => c.id)).size === s.contas.length, 'Contas duplicadas.');
      exigir(
        new Set(s.contas.map((c) => String(c.email).toLowerCase())).size === s.contas.length,
        'E-mail já cadastrado.'
      );
      for (const c of s.contas) {
        exigir(
          String(c.nome || '').trim().length >= 3 &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) &&
            String(c.estabelecimento || '').trim(),
          'Dados do gestor inválidos.'
        );
        exigir(
          Number.isInteger(c.limite) &&
            c.limite >= 1 &&
            c.limite <= 50 &&
            ['ativa', 'revogada'].includes(c.status) &&
            ['freemium', 'premium'].includes(c.plano),
          'Plano, limite ou status inválido.'
        );
        exigir(
          c.status !== 'revogada' || String(c.motivo || '').trim(),
          'Informe o motivo da revogação.'
        );
        const antiga = buscar('gestores', c.id),
          id = antiga?.estabelecimentoId || `estab-${c.id}`;
        salvarEstab({ ...buscar('estabelecimentos', id), id, nome: c.estabelecimento });
        const conta = { ...c, email: c.email.trim().toLowerCase(), estabelecimentoId: id };
        db.prepare(
          'INSERT INTO gestores VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,dados=excluded.dados'
        ).run(c.id, conta.email, id, json(conta));
      }
      setMeta('admin', {
        historico: s.historico || [],
        financeiro: s.financeiro,
        versaoExemplos: 2,
      });
      incrementar();
      return admin();
    });
  }
  seed();
  return {
    listarQuadras,
    quadras,
    grade,
    gestor,
    salvarGestor,
    admin,
    salvarAdmin,
    reservas: (f) =>
      todos('eventos')
        .filter(
          (e) => e.tipo === 'avulsa' && (!f.quadraId || String(e.quadraId) === String(f.quadraId))
        )
        .map(comoReserva),
    criarReserva: (d) =>
      transacao(db, () => {
        const e = criar(d);
        incrementar();
        return comoReserva(e);
      }),
    pagar: (id, metodo) =>
      transacao(db, () => {
        const p = pagar(id, metodo);
        incrementar();
        return p;
      }),
    checkout: (d) =>
      transacao(db, () => {
        exigir(['pix', 'cartao'].includes(d.metodo), 'Selecione Pix ou cartão.');
        const assinatura = json({
          itens: d.itens,
          nomeCliente: d.nomeCliente,
          telefoneCliente: d.telefoneCliente,
          metodo: d.metodo,
        });
        if (d.chave) {
          exigir(
            typeof d.chave === 'string' && d.chave.length <= 128,
            'Chave de checkout inválida.'
          );
          const anterior = db
            .prepare('SELECT pedido,resposta FROM checkouts WHERE chave=?')
            .get(d.chave);
          if (anterior) {
            exigir(anterior.pedido === assinatura, 'Chave já usada por outro pedido.', 409);
            return JSON.parse(anterior.resposta);
          }
        }
        exigir(
          Array.isArray(d.itens) && d.itens.length > 0 && d.itens.length <= 24,
          'Selecione entre 1 e 24 horários.'
        );
        exigir(
          d.itens.every(
            (i) =>
              i &&
              !Array.isArray(i) &&
              (typeof i.quadraId === 'string' || typeof i.quadraId === 'number') &&
              dataValida(i.data) &&
              Number.isFinite(minutos(i.horario))
          ),
          'Cada item precisa de quadra, data e horário válidos.'
        );
        const estabelecimentos = new Set(
          d.itens.map((i) => buscar('quadras', i.quadraId)?.estabelecimentoId)
        );
        exigir(estabelecimentos.size === 1, 'Escolha quadras do mesmo estabelecimento.');
        const reservas = d.itens.map((i) =>
          criar({ ...i, nomeCliente: d.nomeCliente, telefoneCliente: d.telefoneCliente })
        );
        const pagamentos = reservas.map((r) => pagar(r.id, d.metodo));
        incrementar();
        const resposta = {
          reservas: reservas.map((r) => comoReserva(buscar('eventos', r.id))),
          pagamentos,
          total: pagamentos.reduce((s, p) => s + p.valor, 0),
          simulado: true,
        };
        if (d.chave)
          db.prepare('INSERT INTO checkouts VALUES(?,?,?)').run(
            d.chave,
            assinatura,
            json(resposta)
          );
        return resposta;
      }),
    cancelar: (id, motivo) =>
      transacao(db, () => {
        const e = buscar('eventos', id);
        exigir(e, 'Reserva não encontrada.', 404);
        exigir(e.status !== 'cancelada', 'Reserva já cancelada.');
        const n = {
          ...e,
          status: 'cancelada',
          motivoCancelamento: motivo || 'Cancelamento solicitado',
          reembolso: e.pagamento === 'pago' ? 'pendente' : null,
        };
        salvarFilho('eventos', n);
        reconstruirOcupacao();
        incrementar();
        return comoReserva(n);
      }),
    interesse: (d) => {
      conferirAtiva(buscar('quadras', d.quadraId));
      exigir(
        ['espera', 'mensalista'].includes(d.tipo) && String(d.contato || '').trim().length >= 6,
        'Interesse inválido.'
      );
      exigir(
        d.tipo === 'espera'
          ? dataValida(d.data) && Number.isFinite(minutos(d.horario))
          : Number(d.diaSemana) >= 0 &&
              Number(d.diaSemana) <= 6 &&
              Number.isFinite(minutos(d.horario)),
        'Data/horário de interesse inválidos.'
      );
      const chave = json([
        d.tipo,
        String(d.quadraId),
        d.data,
        d.horario,
        d.diaSemana,
        String(d.contato).trim().toLowerCase(),
      ]);
      const r = db
        .prepare('INSERT OR IGNORE INTO interesses VALUES(?,?)')
        .run(chave, json({ ...d, id: randomUUID(), criadoEm: new Date().toISOString() }));
      return { duplicado: r.changes === 0 };
    },
    suporte: (d) => {
      exigir(
        String(d.nome || '').trim() && String(d.mensagem || '').trim(),
        'Informe nome e mensagem.'
      );
      const id = randomUUID();
      db.prepare('INSERT INTO suporte VALUES(?,?)').run(
        id,
        json({ ...d, id, criadoEm: new Date().toISOString() })
      );
      return { id, status: 'recebido' };
    },
  };
}
module.exports = { operacao, ErroOperacao };
