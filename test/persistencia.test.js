const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { abrirBanco } = require('../src/persistence/database');
const { operacao } = require('../src/persistence/operacao');
const { criarAppPersistente } = require('../src/persistence/routes');
const DATA='2027-03-15';
const cliente={nomeCliente:'Jogador Teste',telefoneCliente:'41999990000'};
const pedido=(horario='08:00',quadraId=1)=>({...cliente,quadraId,data:DATA,horario});
function base(t) { const db=abrirBanco(':memory:'); t.after(()=>db.close()); return operacao(db); }
function rejeita(fn,status) { assert.throws(fn,e=>e.status===status); }

test('checkout persiste e é visível no gestor, sem misturar outra arena',t=>{
  const s=base(t);
  const r=s.checkout({...cliente,itens:[pedido(),pedido('09:00')],metodo:'pix'});
  assert.equal(r.total,360); assert.equal(r.reservas.length,2);
  assert.ok(r.reservas.every(r=>r.status==='confirmada'));
  assert.equal(s.gestor().eventos.filter(e=>r.reservas.some(r=>r.id===e.id)).length,2);
  const outra=s.checkout({...cliente,itens:[pedido('08:00',7)],metodo:'cartao'});
  assert.ok(!s.gestor().eventos.some(e=>e.id===outra.reservas[0].id));
});
test('horários duplicados e checkout parcialmente ocupado revertem a transação inteira',t=>{
  const s=base(t); s.criarReserva(pedido('09:00'));
  rejeita(()=>s.checkout({...cliente,itens:[pedido(),pedido('09:00')],metodo:'pix'}),409);
  assert.ok(s.grade(1,DATA).horariosLivres.includes('08:00'));
  rejeita(()=>s.checkout({...cliente,itens:[pedido(),pedido()],metodo:'pix'}),409);
  assert.ok(s.grade(1,DATA).horariosLivres.includes('08:00'));
});
test('cancelamento libera horário, mantém histórico e marca reembolso apenas simulado',t=>{
  const s=base(t);const r=s.checkout({...cliente,itens:[pedido()],metodo:'pix'}).reservas[0];
  const c=s.cancelar(r.id,'Teste');assert.equal(c.reembolso,'pendente');
  assert.ok(s.grade(1,DATA).horariosLivres.includes('08:00'));
  rejeita(()=>s.pagar(r.id,'pix'),400); rejeita(()=>s.cancelar(r.id),400);
  assert.equal(s.reservas({}).find(e=>e.id===r.id).status,'cancelada');
});
test('bloqueios e mensalistas são verificados no servidor, inclusive sobreposições parciais',t=>{
  const s=base(t);let g=s.gestor();
  g.eventos.push({id:'bloq',quadraId:1,data:DATA,inicio:'08:30',fim:'09:30',tipo:'bloqueio',status:'confirmada',valor:0});
  s.salvarGestor(g);rejeita(()=>s.criarReserva(pedido()),409);rejeita(()=>s.criarReserva(pedido('09:00')),409);
  g=s.gestor();g.mensalistas.push({id:'mensal-teste',quadraId:1,cliente:'Time',telefone:'41999990000',dia:1,inicio:'10:00',fim:'11:00',de:DATA,ate:'2027-04-15',valorMensal:500,excecoes:[]});
  s.salvarGestor(g);rejeita(()=>s.criarReserva(pedido('10:00')),409);
  assert.ok(s.grade(1,'2027-03-22').horariosOcupados.includes('10:00'));
  g=s.gestor();g.mensalistas.find(m=>m.id==='mensal-teste').excecoes=[DATA];s.salvarGestor(g);
  assert.ok(s.grade(1,DATA).horariosLivres.includes('10:00'));
});
test('mensalista com conflito e revisão antiga não apagam reservas de outro navegador',t=>{
  const s=base(t);const antigo=s.gestor();s.criarReserva(pedido());
  rejeita(()=>s.salvarGestor(antigo),409);assert.equal(s.reservas({}).filter(e=>e.data===DATA).length,1);
  const g=s.gestor();g.mensalistas.push({id:'conflito',quadraId:1,dia:1,inicio:'08:00',fim:'09:00',de:DATA,ate:DATA,valorMensal:500});
  rejeita(()=>s.salvarGestor(g),409);assert.ok(!s.gestor().mensalistas.some(m=>m.id==='conflito'));
});
test('regra de data prevalece e reserva preserva preço contratado, pagamento único',t=>{
  const s=base(t);let g=s.gestor();
  g.regras=[{id:'semana',quadraId:1,tipo:'semanal',dia:1,inicio:'08:00',fim:'10:00',valor:140},{id:'promo',quadraId:1,tipo:'data',data:DATA,inicio:'08:00',fim:'09:00',valor:80,promocao:true}];s.salvarGestor(g);
  assert.equal(s.grade(1,DATA).precos['08:00'].valor,80);
  assert.equal(s.grade(1,DATA).precos['09:00'].valor,140);
  const r=s.criarReserva({...pedido(),valor:1}); assert.equal(r.valorTotal,80);
  g=s.gestor();g.regras=[];g.quadras[0].precoHora=999;s.salvarGestor(g);
  assert.equal(s.pagar(r.id,'pix').valor,80);rejeita(()=>s.pagar(r.id,'cartao'),409);
});
test('limite e revogação são aplicados na API e no catálogo',t=>{
  const s=base(t);let a=s.admin();a.contas[0].limite=3;s.salvarAdmin(a);
  const g=s.gestor();g.quadras.push({...g.quadras[0],id:'nova'});rejeita(()=>s.salvarGestor(g),400);
  a=s.admin();a.contas[0].status='revogada';a.contas[0].motivo='Teste';s.salvarAdmin(a);
  assert.ok(!s.quadras().some(q=>q.estabelecimentoId==='arena-batel'));
  rejeita(()=>s.criarReserva(pedido()),403);rejeita(()=>s.salvarGestor(s.gestor()),403);
  a=s.admin();a.contas[0].status='ativa';s.salvarAdmin(a);assert.ok(s.quadras().some(q=>q.id===1));
});
test('persistência sobrevive a fechar e abrir banco e seed não duplica dados',()=>{
  const arquivo=join(mkdtempSync(join(tmpdir(),'quadrafacil-test-')),'teste.sqlite');
  let db=abrirBanco(arquivo),s=operacao(db);const total=s.quadras().length;
  const r=s.checkout({...cliente,itens:[pedido()],metodo:'pix'}).reservas[0];db.close();
  db=abrirBanco(arquivo);try {s=operacao(db);assert.equal(s.quadras().length,total);assert.ok(s.gestor().eventos.some(e=>e.id===r.id));rejeita(()=>s.criarReserva(pedido()),409);} finally {db.close();}
});
test('valida data impossível, telefone, grade, escopo e checkout de arenas diferentes',t=>{
  const s=base(t);rejeita(()=>s.grade(1,'2027-02-30'),400);rejeita(()=>s.grade(1,'x'),400);
  rejeita(()=>s.criarReserva({...pedido(),telefoneCliente:'12'}),400);
  rejeita(()=>s.criarReserva(pedido('07:00')),409);
  rejeita(()=>s.criarReserva({...pedido(),data:'2000-01-01'}),400);
  rejeita(()=>s.checkout({...cliente,itens:[pedido(),pedido('08:00',7)],metodo:'pix'}),400);
  const g=s.gestor();g.quadras.push({...g.quadras[0],id:7});rejeita(()=>s.salvarGestor(g),403);
});
test('interesses são deduplicados no banco e suporte é persistido',t=>{
  const s=base(t),d={tipo:'espera',quadraId:1,data:DATA,horario:'08:00',contato:'41999990000'};
  assert.equal(s.interesse(d).duplicado,false);assert.equal(s.interesse(d).duplicado,true);
  assert.equal(s.suporte({nome:'Teste',mensagem:'Preciso de ajuda'}).status,'recebido');
});
test('HTTP real: concorrência oferece uma única vaga e erros não viram 500',async t=>{
  const db=abrirBanco(':memory:');const app=criarAppPersistente(db);
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
  t.after(()=>{server.close();db.close();});const url=`http://127.0.0.1:${server.address().port}/api`;
  const respostas=await Promise.all([1,2].map(()=>fetch(`${url}/checkout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...cliente,itens:[pedido()],metodo:'pix'})})));
  assert.deepEqual(respostas.map(r=>r.status).sort(),[201,409]);
  assert.equal((await fetch(`${url}/quadras/1/horarios?data=2027-02-30`)).status,400);
  assert.equal((await fetch(`${url}/health`)).status,200);
});
