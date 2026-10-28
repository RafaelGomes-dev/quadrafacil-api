# Integração do protótipo

## Fonte de verdade

SQLite local em `data/quadrafacil.sqlite`, criado por migração e seed na primeira execução.
Node 24 LTS recomendado (`node:sqlite`). Sem serviço de banco externo. Não apagar o arquivo
para reiniciar a aplicação. Dados de exemplo são inseridos uma única vez.

## Demonstração

O gestor fixo é `gestor-arena-batel`, estabelecimento `arena-batel`.
Quadras 1 e 2: Society; quadra 4: Beach tennis. O jogador pode reservar qualquer
estabelecimento, mas somente reservas da Arena Batel aparecem neste painel de gestor.
Barra DEMO mantida. Não há autenticação: uso local acadêmico, não publicar esta API na Internet.
Pagamento, reembolso e notificações não movimentam dinheiro nem enviam mensagens.

## Contratos necessários

- GET /api/quadras, /quadras/:id e /quadras/:id/horarios: catálogo e disponibilidade do banco.
- POST /api/checkout: reserva de múltiplos horários e confirmação simulada em uma transação.
- GET/POST /api/reservas, PATCH /api/reservas/:id/cancelar e POST /api/pagamentos: compatibilidade.
- GET/PUT /api/gestor: estabelecimento, quadras, agenda, bloqueios, preços e mensalistas.
- GET/PUT /api/admin: contas, limites, situação, planos e patrocínio.
- POST /api/interesses e /api/suporte: persistência de solicitações, sem notificações automáticas.

Edição do painel usa revisão otimista: alteração concorrente retorna 409, nunca sobrescreve
silenciosamente reservas criadas por outro navegador. Intervalos ativos são materializados
em ocupações de 30 minutos com chave única por quadra/data/horário, dentro da transação.
Mensalistas materializam apenas a vigência (máximo um ano). Preço da data > semanal > padrão.
O valor da reserva é fixado no servidor e não é recalculado por alteração de preço posterior.

O front envia `totalEsperado` no checkout. O servidor calcula o total independentemente:
se houver divergência, retorna 409 e desfaz reservas/pagamentos para permitir revisar
o novo preço. O campo é opcional para compatibilidade com clientes antigos; não define
o valor cobrado. Faz parte da assinatura da chave idempotente.

O PUT do gestor preserva quadra, data, intervalo, tipo e origem de eventos existentes.
Mudanças de agenda exigem cancelar e criar outra reserva; editar preços não altera
reservas anteriores. Confirmação do checkout independe da releitura dos painéis.

## Financeiro e inteligência

Financeiro do gestor deve usar reservas e mensalidades persistidas, sem descontar taxa do dono.
Pagamento continua simulado. Inteligência histórica e projeção de negócio do superadmin
permanecem identificadas como ilustrativas, não são faturamento realizado.

## Verificação

Reservar como jogador, abrir gestor, recarregar e reiniciar a API: reserva preservada.
Testar concorrência, sobreposição com bloqueio/mensalista, cancelamento, pagamento duplicado,
preço calculado no servidor, revisão desatualizada, conta revogada e isolamento entre arenas.
