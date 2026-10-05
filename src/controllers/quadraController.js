/**
 * Controller de quadras: traduz requisições HTTP em chamadas ao
 * quadraService e formata as respostas JSON.
 */

const quadraService = require('../services/quadraService');

/**
 * GET /api/quadras
 * Lista quadras aplicando os filtros de busca recebidos via query string.
 */
function listarQuadras(req, res) {
  const { cidade, bairro, esporte, precoMin, precoMax, data, horario } = req.query;
  const quadrasFiltradas = quadraService.buscarQuadrasComFiltros({
    cidade,
    bairro,
    esporte,
    precoMin,
    precoMax,
    data,
    horario,
  });

  res.status(200).json(quadrasFiltradas);
}

/**
 * GET /api/quadras/:id
 * Retorna uma quadra específica ou 404 se não existir.
 */
function obterQuadraPorId(req, res) {
  const quadra = quadraService.buscarQuadraPorId(req.params.id);

  if (!quadra) {
    return res.status(404).json({ error: 'Quadra não encontrada.' });
  }

  res.status(200).json(quadra);
}

/**
 * GET /api/quadras/:id/horarios?data=AAAA-MM-DD
 * Retorna os horários livres e ocupados de uma quadra na data informada.
 */
function obterHorariosDaQuadra(req, res) {
  const quadra = quadraService.buscarQuadraPorId(req.params.id);
  if (!quadra) {
    return res.status(404).json({ error: 'Quadra não encontrada.' });
  }

  const { data } = req.query;
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res
      .status(400)
      .json({ error: 'O parâmetro "data" é obrigatório (formato AAAA-MM-DD).' });
  }

  const grade = quadraService.montarGradeDeHorarios(req.params.id, data);
  res.status(200).json(grade);
}

/**
 * POST /api/quadras
 * Cadastra uma nova quadra enviada pelo gestor/proprietário.
 */
function cadastrarQuadra(req, res) {
  const erros = quadraService.validarDadosDeQuadra(req.body);
  if (erros.length > 0) {
    return res.status(400).json({ error: 'Dados inválidos.', detalhes: erros });
  }

  const quadraCriada = quadraService.cadastrarQuadra(req.body);
  res.status(201).json(quadraCriada);
}

module.exports = {
  listarQuadras,
  obterQuadraPorId,
  obterHorariosDaQuadra,
  cadastrarQuadra,
};
