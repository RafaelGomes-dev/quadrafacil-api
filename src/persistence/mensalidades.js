/** Competência mensal: uma cobrança por contrato, não por versão da recorrência.
 * O valor da primeira versão vigente no mês vale até o fim da competência.
 * Mudanças de valor no meio do mês passam a valer na competência seguinte, sem pró-rata.
 * Isto é um extrato do protótipo, não emissão fiscal ou cobrança bancária.
 */
function mensalidadesDoMes(versoes, referencia) {
  const mes = referencia.slice(0, 7),
    inicio = `${mes}-01`;
  const fim = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
  const contratos = new Map();
  for (const m of versoes) {
    if (m.de > fim || m.ate < inicio) continue;
    const id = m.contratoId || m.id;
    if (!contratos.has(id)) contratos.set(id, []);
    contratos.get(id).push(m);
  }
  return [...contratos].map(([contratoId, itens]) => {
    itens.sort((a, b) => a.de.localeCompare(b.de));
    const primeira = itens[0];
    const atual = itens.filter((m) => m.de <= referencia).at(-1) || primeira;
    return {
      id: `MENS-${contratoId}-${mes}`,
      contratoId,
      mes,
      data: primeira.de > inicio ? primeira.de : inicio,
      quadraId: primeira.quadraId,
      cliente: atual.cliente,
      valor: Math.round(primeira.valorMensal * 100),
      status: itens.some((m) => m.de <= referencia && m.pagamento === 'pago') ? 'paga' : 'pendente',
      tipo: 'mensalidade',
      origem: 'Presencial',
      metodo: 'Mensalidade',
      repasse: 'direto',
    };
  });
}
module.exports = { mensalidadesDoMes };
