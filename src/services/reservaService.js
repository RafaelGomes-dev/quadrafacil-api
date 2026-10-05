/**
 * Regras de negócio relacionadas a reservas: validação, checagem de
 * conflito de horário, criação, listagem e cancelamento.
 */

const { reservas, gerarProximoIdReserva } = require('../data/mockData');
const {
  buscarQuadraPorId,
  horarioDentroDoFuncionamento,
  HORARIOS_PADRAO,
} = require('./quadraService');

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;
const REGEX_TELEFONE = /^\d{10,11}$/;

/** Verifica se uma data AAAA-MM-DD existe no calendário. */
function dataISOValida(data) {
  if (!REGEX_DATA.test(data)) return false;

  const [ano, mes, dia] = data.split('-').map(Number);
  const dataNormalizada = new Date(Date.UTC(ano, mes - 1, dia));

  return (
    dataNormalizada.getUTCFullYear() === ano &&
    dataNormalizada.getUTCMonth() === mes - 1 &&
    dataNormalizada.getUTCDate() === dia
  );
}

/** Retorna a data local atual no formato AAAA-MM-DD. */
function obterDataLocalAtual() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Lista reservas, opcionalmente filtradas por quadra.
 * @param {object} filtros
 * @param {string|number} [filtros.quadraId]
 * @returns {object[]}
 */
function listarReservas(filtros = {}) {
  const { quadraId } = filtros;
  if (!quadraId) return reservas;
  return reservas.filter((reserva) => reserva.quadraId === Number(quadraId));
}

/**
 * Valida os campos obrigatórios de uma solicitação de reserva.
 * @param {object} dadosReserva
 * @returns {string[]} Lista de mensagens de erro (vazia se tudo for válido).
 */
function validarDadosDeReserva(dadosReserva) {
  const erros = [];
  const { quadraId, nomeCliente, telefoneCliente, data, horario } = dadosReserva;

  if (!quadraId) erros.push('O campo "quadraId" é obrigatório.');
  else if (!buscarQuadraPorId(quadraId)) erros.push('Quadra informada não foi encontrada.');

  if (!nomeCliente || !String(nomeCliente).trim()) {
    erros.push('O campo "nomeCliente" é obrigatório.');
  }
  const telefoneNormalizado = String(telefoneCliente || '').replace(/\D/g, '');
  if (!telefoneNormalizado) {
    erros.push('O campo "telefoneCliente" é obrigatório.');
  } else if (!REGEX_TELEFONE.test(telefoneNormalizado)) {
    erros.push('O campo "telefoneCliente" deve conter 10 ou 11 dígitos.');
  }
  if (!data || !dataISOValida(data)) {
    erros.push('O campo "data" é obrigatório e deve estar no formato AAAA-MM-DD.');
  } else if (data < obterDataLocalAtual()) {
    erros.push('Não é possível reservar uma data que já passou.');
  }
  if (!horario || !REGEX_HORARIO.test(horario)) {
    erros.push('O campo "horario" é obrigatório e deve estar no formato HH:mm.');
  } else if (!HORARIOS_PADRAO.includes(horario)) {
    erros.push('O campo "horario" deve corresponder a um horário disponível da grade.');
  } else if (quadraId && !horarioDentroDoFuncionamento(buscarQuadraPorId(quadraId), horario)) {
    erros.push('O horário escolhido está fora do horário de funcionamento da quadra.');
  }

  return erros;
}

/**
 * Verifica se já existe reserva ativa (pendente ou confirmada) para a
 * mesma quadra, data e horário.
 * @param {number} quadraId
 * @param {string} data
 * @param {string} horario
 * @returns {boolean}
 */
function existeConflitoDeHorario(quadraId, data, horario) {
  return reservas.some(
    (reserva) =>
      reserva.quadraId === Number(quadraId) &&
      reserva.data === data &&
      reserva.horario === horario &&
      reserva.status !== 'cancelada'
  );
}

/**
 * Cria uma nova reserva com status inicial "pendente".
 * @param {object} dadosReserva
 * @returns {object} A reserva criada.
 */
function criarReserva(dadosReserva) {
  const novaReserva = {
    id: gerarProximoIdReserva(),
    quadraId: Number(dadosReserva.quadraId),
    nomeCliente: String(dadosReserva.nomeCliente).trim(),
    telefoneCliente: String(dadosReserva.telefoneCliente).replace(/\D/g, ''),
    data: dadosReserva.data,
    horario: dadosReserva.horario,
    status: 'pendente',
    criadaEm: new Date().toISOString(),
  };

  reservas.push(novaReserva);
  return novaReserva;
}

/**
 * Busca uma reserva pelo id.
 * @param {number} reservaId
 * @returns {object|undefined}
 */
function buscarReservaPorId(reservaId) {
  return reservas.find((reserva) => reserva.id === Number(reservaId));
}

/**
 * Cancela uma reserva, liberando o horário correspondente.
 * @param {number} reservaId
 * @returns {object|null} A reserva cancelada, ou null se não encontrada.
 */
function cancelarReserva(reservaId) {
  const reserva = buscarReservaPorId(reservaId);
  if (!reserva) return null;

  reserva.status = 'cancelada';
  return reserva;
}

/**
 * Confirma uma reserva após o pagamento ser aprovado.
 * @param {number} reservaId
 * @returns {object|null} A reserva confirmada, ou null se não encontrada.
 */
function confirmarReserva(reservaId) {
  const reserva = buscarReservaPorId(reservaId);
  if (!reserva) return null;

  reserva.status = 'confirmada';
  return reserva;
}

module.exports = {
  listarReservas,
  validarDadosDeReserva,
  existeConflitoDeHorario,
  criarReserva,
  buscarReservaPorId,
  cancelarReserva,
  confirmarReserva,
};
