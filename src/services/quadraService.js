/**
 * Regras de negócio relacionadas a quadras: busca com filtros, consulta por
 * id, cálculo de horários livres/ocupados e cadastro de novas quadras.
 */

const { quadras, reservas, gerarProximoIdQuadra } = require('../data/mockData');

const HORARIOS_PADRAO = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
];

/**
 * Filtra a lista de quadras conforme os critérios de busca informados pelo
 * jogador/organizador.
 * @param {object} filtros
 * @param {string} [filtros.cidade]
 * @param {string} [filtros.bairro]
 * @param {string} [filtros.esporte]
 * @param {string|number} [filtros.precoMin]
 * @param {string|number} [filtros.precoMax]
 * @param {string} [filtros.data]
 * @param {string} [filtros.horario]
 * @returns {object[]} Lista de quadras que atendem aos filtros.
 */
function buscarQuadrasComFiltros(filtros) {
  const { cidade, bairro, esporte, precoMin, precoMax, data, horario } = filtros;

  return quadras.filter((quadra) => {
    if (cidade && !normalizar(quadra.cidade).includes(normalizar(cidade))) return false;
    if (bairro && !normalizar(quadra.bairro).includes(normalizar(bairro))) return false;
    if (esporte && normalizar(quadra.esporte) !== normalizar(esporte)) return false;
    if (precoMin && quadra.precoHora < Number(precoMin)) return false;
    if (precoMax && quadra.precoHora > Number(precoMax)) return false;
    if (data && horario && !horarioEstaLivre(quadra.id, data, horario)) return false;
    return true;
  });
}

/** Remove acentos e normaliza para minúsculas, para comparação de texto. */
function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Busca uma quadra pelo id.
 * @param {number} quadraId
 * @returns {object|undefined} A quadra encontrada ou undefined.
 */
function buscarQuadraPorId(quadraId) {
  return quadras.find((quadra) => quadra.id === Number(quadraId));
}

/**
 * Verifica se um horário específico está livre para uma quadra em uma data.
 * @param {number} quadraId
 * @param {string} data - Data no formato AAAA-MM-DD.
 * @param {string} horario - Horário no formato HH:mm.
 * @returns {boolean} true se não houver reserva ativa no horário.
 */
function horarioEstaLivre(quadraId, data, horario) {
  const existeReservaAtiva = reservas.some(
    (reserva) =>
      reserva.quadraId === Number(quadraId) &&
      reserva.data === data &&
      reserva.horario === horario &&
      reserva.status !== 'cancelada'
  );
  return !existeReservaAtiva;
}

/** Converte um horário "HH:mm" em minutos desde a meia-noite. */
function converterParaMinutos(horario) {
  const [horas, minutos] = String(horario).split(':').map(Number);
  return horas * 60 + minutos;
}

/**
 * Verifica se uma reserva de 1 hora cabe no horário de funcionamento da
 * quadra (começa depois da abertura e termina até o fechamento).
 * @param {object} quadra
 * @param {string} horario - Horário de início no formato HH:mm.
 * @returns {boolean}
 */
function horarioDentroDoFuncionamento(quadra, horario) {
  if (!quadra?.horarioFuncionamento) return true;

  const { abertura, fechamento } = quadra.horarioFuncionamento;
  const inicio = converterParaMinutos(horario);
  return (
    inicio >= converterParaMinutos(abertura) && inicio + 60 <= converterParaMinutos(fechamento)
  );
}

/**
 * Monta a grade de horários livres e ocupados de uma quadra em uma data,
 * considerando só os horários dentro do funcionamento da quadra.
 * @param {number} quadraId
 * @param {string} data - Data no formato AAAA-MM-DD.
 * @returns {{horariosLivres: string[], horariosOcupados: string[]}}
 */
function montarGradeDeHorarios(quadraId, data) {
  const quadra = buscarQuadraPorId(quadraId);
  const horariosDaQuadra = HORARIOS_PADRAO.filter((horario) =>
    horarioDentroDoFuncionamento(quadra, horario)
  );

  const horariosOcupados = reservas
    .filter(
      (reserva) =>
        reserva.quadraId === Number(quadraId) &&
        reserva.data === data &&
        reserva.status !== 'cancelada'
    )
    .map((reserva) => reserva.horario);

  const horariosLivres = horariosDaQuadra.filter((horario) => !horariosOcupados.includes(horario));

  return { horariosLivres, horariosOcupados };
}

/**
 * Valida os dados de cadastro de uma quadra enviados pelo gestor.
 * @param {object} dadosQuadra
 * @returns {string[]} Lista de mensagens de erro (vazia se tudo for válido).
 */
function validarDadosDeQuadra(dadosQuadra) {
  const erros = [];
  const { nome, endereco, cidade, esporte, precoHora } = dadosQuadra;

  if (!nome || !String(nome).trim()) erros.push('O campo "nome" é obrigatório.');
  if (!endereco || !String(endereco).trim()) erros.push('O campo "endereco" é obrigatório.');
  if (!cidade || !String(cidade).trim()) erros.push('O campo "cidade" é obrigatório.');
  if (!esporte || !String(esporte).trim()) erros.push('O campo "esporte" é obrigatório.');
  if (precoHora === undefined || precoHora === null || precoHora === '') {
    erros.push('O campo "precoHora" é obrigatório.');
  } else if (Number.isNaN(Number(precoHora)) || Number(precoHora) <= 0) {
    erros.push('O campo "precoHora" precisa ser um número maior que zero.');
  }

  return erros;
}

/**
 * Cria e persiste (em memória) uma nova quadra cadastrada pelo gestor.
 * @param {object} dadosQuadra
 * @returns {object} A quadra criada, já com id incremental.
 */
function cadastrarQuadra(dadosQuadra) {
  const novaQuadra = {
    id: gerarProximoIdQuadra(),
    nome: dadosQuadra.nome,
    endereco: dadosQuadra.endereco,
    cidade: dadosQuadra.cidade,
    bairro: dadosQuadra.bairro || '',
    esporte: dadosQuadra.esporte,
    precoHora: Number(dadosQuadra.precoHora),
    estrutura: {
      vestiario: Boolean(dadosQuadra.estrutura?.vestiario),
      estacionamento: Boolean(dadosQuadra.estrutura?.estacionamento),
      iluminacao: Boolean(dadosQuadra.estrutura?.iluminacao),
      coberta: Boolean(dadosQuadra.estrutura?.coberta),
    },
    fotos: Array.isArray(dadosQuadra.fotos) ? dadosQuadra.fotos : [],
    horarioFuncionamento: dadosQuadra.horarioFuncionamento || {
      abertura: '08:00',
      fechamento: '22:00',
    },
    descricao: dadosQuadra.descricao || '',
  };

  quadras.push(novaQuadra);
  return novaQuadra;
}

module.exports = {
  HORARIOS_PADRAO,
  buscarQuadrasComFiltros,
  buscarQuadraPorId,
  horarioEstaLivre,
  horarioDentroDoFuncionamento,
  montarGradeDeHorarios,
  validarDadosDeQuadra,
  cadastrarQuadra,
};
