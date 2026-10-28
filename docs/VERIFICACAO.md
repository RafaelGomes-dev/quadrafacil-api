# Verificação da integração — 28/10/2026

## Testes automatizados

- API: `node --test`, 45 testes aprovados.
- Front: `node --test`, 60 testes aprovados.
- Front: build Vite concluído; lint sem erros, com quatro avisos já existentes de
  `set-state-in-effect` em páginas de quadras.
- SQLite: `PRAGMA integrity_check` retornou `ok`; `foreign_key_check` não retornou violações.

## Navegador

Chrome headless, jogador em viewport mobile e gestor em desktop, dois contextos sem
cookies/localStorage compartilhados. Scripts no repo do front:

- `scripts/verificar-fluxo.mjs`: busca da Arena Batel, seleção de horário, checkout Pix
  simulado, aparecimento na lista do gestor por atualização da API, reload, cancelamento
  com motivo e liberação da vaga. Nenhum erro de JavaScript.
- `scripts/verificar-gestao.mjs`: reserva manual pelo formulário, origem WhatsApp,
  promoção salva pelo gestor e cotação de R$ 75 no servidor, revogação da conta tirando
  a Arena Batel do catálogo, reativação. Nenhum erro de JavaScript.
- `scripts/verificar-regressoes.mjs`: oferta de R$ 80 não oculta horários de R$ 180
  na faixa de R$ 100 a R$ 200; detalhe mantém somente horários compatíveis. Editar
  mensalista mantém duas versões da agenda e uma única mensalidade no extrato.
  Recarregamento confirmado e nenhum erro de JavaScript.
- `scripts/verificar-checkout.mjs`: altera o preço enquanto o checkout está aberto,
  confirma erro 409 sem reserva nem pagamento gravado e exige revisão do novo total.
  A segunda tentativa confirma uma única reserva. Leituras do painel são interrompidas
  após o POST bem-sucedido, e a confirmação continua aparecendo. Nenhum erro de JavaScript.

As reservas de teste foram canceladas (histórico mantido); a promoção temporária foi
removida e a conta da Arena Batel terminou ativa.

O servidor foi reiniciado sem apagar o arquivo SQLite e os registros anteriores
continuaram disponíveis. O teste de persistência também fecha e reabre uma conexão
de arquivo temporário, verificando reserva, seed sem duplicação e conflito preservado.

## Regressões e regras verificadas

O relógio usa `America/Sao_Paulo` e pode ser injetado nos testes. Horários que já
começaram não podem ser reservados nem pagos, inclusive pela reserva manual ou por
um novo bloqueio. O histórico permanece disponível. Busca por horário sem data
considera hoje. A faixa de preço é aplicada a cada horário antes de calcular o
menor valor apresentado. Itens inválidos no checkout retornam erro de validação;
bloqueios e reservas já recebidas não podem ser pagos novamente.

Mensalistas conservam `contratoId` ao mudar a recorrência; cada versão mantém seu
próprio `id` e informa `versaoAnteriorId`. O servidor calcula uma mensalidade por
contrato e mês, sem juntar contratos diferentes do mesmo cliente. O valor da
primeira versão vigente no mês é mantido naquele mês; reajustes no meio do mês
valem no próximo, sem cálculo proporcional. Uma mensalidade já recebida continua
recebida ao editar a recorrência. Este é um extrato derivado dos acordos salvos,
sem cobrança bancária real.

Uma gravação confirmada pela API continua confirmada se a atualização posterior
da tela falhar; falha na própria gravação continua sendo informada ao usuário.

Reservas existentes não podem mudar de quadra, data, intervalo, tipo ou origem pelo
PUT do gestor. Para mudar a agenda, é necessário cancelar e criar outra reserva,
preservando o histórico. O checkout envia `totalEsperado`; divergência com o preço
calculado no servidor retorna 409 e desfaz toda a transação. O front relê os preços
e pede nova confirmação. Repetir um checkout já confirmado mantém a idempotência.

## O que não foi alegado

Não houve pagamento real, autenticação de produção, envio de mensagem, emissão fiscal,
teste de carga, validação com usuários ou implantação pública. Inteligência histórica
e projeção financeira da equipe continuam ilustrativas. Fotos novas são ilustrativas
e locais, com fontes e licenças no rodapé do site.
