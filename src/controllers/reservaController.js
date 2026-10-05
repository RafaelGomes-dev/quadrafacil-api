/**
 * Controller de reservas: traduz requisições HTTP em chamadas ao
 * reservaService, incluindo a checagem de conflito de horário.
 */

const reservaService = require('../services/reservaService');

/**
 * GET /api/reservas
 * Lista reservas, opcionalmente filtradas por ?quadraId=
 */
function listarReservas(req, res) {
  const reservasEncontradas = reservaService.listarReservas({ quadraId: req.query.quadraId });
  res.status(200).json(reservasEncontradas);
}

/**
 * POST /api/reservas
 * Cria uma reserva "pendente" após validar os dados e checar conflito
 * de horário na mesma quadra (retorna 409 quando houver conflito).
 */
function criarReserva(req, res) {
  const erros = reservaService.validarDadosDeReserva(req.body);
  if (erros.length > 0) {
    return res.status(400).json({ error: 'Dados inválidos.', detalhes: erros });
  }

  const { quadraId, data, horario } = req.body;
  if (reservaService.existeConflitoDeHorario(quadraId, data, horario)) {
    return res.status(409).json({ error: 'Este horário já está reservado para esta quadra.' });
  }

  const reservaCriada = reservaService.criarReserva(req.body);
  res.status(201).json(reservaCriada);
}

/**
 * PATCH /api/reservas/:id/cancelar
 * Cancela uma reserva, liberando o horário para novas reservas
 * (retorna 400 se ela já estiver cancelada).
 */
function cancelarReserva(req, res) {
  const reserva = reservaService.buscarReservaPorId(req.params.id);

  if (!reserva) {
    return res.status(404).json({ error: 'Reserva não encontrada.' });
  }

  if (reserva.status === 'cancelada') {
    return res.status(400).json({ error: 'Esta reserva já está cancelada.' });
  }

  const reservaCancelada = reservaService.cancelarReserva(req.params.id);
  res.status(200).json(reservaCancelada);
}

module.exports = {
  listarReservas,
  criarReserva,
  cancelarReserva,
};
