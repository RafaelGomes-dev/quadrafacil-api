// A operação é de Curitiba, independentemente do fuso do computador que executa a API.
const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
function instanteLocal(data) {
  const p = Object.fromEntries(formato.formatToParts(data).map((p) => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
module.exports = { instanteLocal };
