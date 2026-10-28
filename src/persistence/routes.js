const express = require('express');
const { operacao } = require('./operacao');
const { abrirBanco } = require('./database');

function criarAppPersistente(db = abrirBanco()) {
  const app = express();
  const service = operacao(db);
  app.use(require('../middlewares/cors'));
  app.use(express.json({limit:'8mb'}));
  const router=express.Router();
  router.get('/health',(req,res)=>res.json({status:'API running!',persistencia:'sqlite',pagamento:'simulado'}));
  router.get('/quadras',(req,res)=>res.json(service.listarQuadras(req.query)));
  router.get('/quadras/:id/horarios',(req,res)=>res.json(service.grade(req.params.id,req.query.data)));
  router.get('/quadras/:id',(req,res)=>{
    const q=service.quadras().find(q=>String(q.id)===req.params.id);
    if(!q) return res.status(404).json({error:'Quadra não encontrada.'});
    res.json(q);
  });
  router.post('/quadras',(req,res)=>{
    const estado=service.gestor();
    const q={...req.body,id:require('node:crypto').randomUUID(),ativa:true};
    const salvo=service.salvarGestor({...estado,quadras:[...estado.quadras,q]});
    res.status(201).json(salvo.quadras.at(-1));
  });
  router.get('/reservas',(req,res)=>res.json(service.reservas(req.query)));
  router.post('/reservas',(req,res)=>res.status(201).json(service.criarReserva(req.body)));
  router.patch('/reservas/:id/cancelar',(req,res)=>res.json(service.cancelar(req.params.id,req.body?.motivo)));
  router.post('/pagamentos',(req,res)=>res.status(201).json(service.pagar(req.body.reservaId,req.body.metodo)));
  router.post('/checkout',(req,res)=>res.status(201).json(service.checkout(req.body)));
  router.get('/gestor',(req,res)=>res.json(service.gestor()));
  router.put('/gestor',(req,res)=>res.json(service.salvarGestor(req.body)));
  router.get('/admin',(req,res)=>res.json(service.admin()));
  router.put('/admin',(req,res)=>res.json(service.salvarAdmin(req.body)));
  router.post('/interesses',(req,res)=>res.status(201).json(service.interesse(req.body)));
  router.post('/suporte',(req,res)=>res.status(201).json(service.suporte(req.body)));
  app.use('/api',router);
  app.use((req,res)=>res.status(404).json({error:'Rota não encontrada.'}));
  app.use((error,req,res,next)=>{
    if(error.status) return res.status(error.status).json({error:error.message});
    console.error(error);
    res.status(500).json({error:'Não foi possível concluir a operação.'});
  });
  return app;
}
module.exports={criarAppPersistente};
