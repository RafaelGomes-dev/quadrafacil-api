# QuadraFácil API

Backend do protótipo acadêmico de reserva de espaços esportivos. Node.js + Express 5,
com **SQLite em arquivo**, transações e controle de concorrência. O catálogo, reservas,
agenda, mensalistas, bloqueios, preços, contas de gestores e solicitações são persistidos.

## Executar

Requer **Node.js 24 LTS** (usa o módulo nativo `node:sqlite`) e npm.

```sh
npm ci
# Copiar .env.example para .env (ou definir as variáveis abaixo).
npm run dev
```

Ou `npm start`, sem reinício automático. API em `http://localhost:3001/api`.
No Windows, se a política do PowerShell bloquear npm.ps1, use `npm.cmd`.

| Variável | Padrão | Uso |
|---|---|---|
| PORT | 3001 | Porta HTTP |
| CORS_ORIGIN | http://localhost:5173 | Origem permitida do front |
| DB_PATH | data/quadrafacil.sqlite (absoluto, relativo ao repo) | Arquivo SQLite |

O servidor escuta apenas em `127.0.0.1`. `DATABASE_URL` e `API_SECRET` da versão antiga
não são usados nesta etapa. Não precisa instalar PostgreSQL ou Docker.

Na primeira execução, o esquema é criado/versionado e `src/data/seed.json` é importado
uma única vez. **Reiniciar a API não apaga dados.** O arquivo SQLite, seus arquivos WAL
e SHM e o `.env` não são versionados. Para backup, pare o servidor e copie a pasta `data/`.
Não apague o banco durante a apresentação. O seed é fictício e tem datas de referência;
não regenera reservas automaticamente a cada dia.

## Demonstração integrada

O gestor fixo administra **Arena Batel**, ID `arena-batel`, conta `gestor-arena-batel`:

- Quadra 1, ID 1: Society aberta, R$ 180/h padrão.
- Quadra 2, ID 2: Society coberta, R$ 120/h padrão.
- Quadra 3, ID 4: Beach tennis, R$ 90/h padrão.

Jogador: `http://localhost:5173/user`. Gestor: `/gestor`. Equipe: `/superadmin`.
A barra DEMO alterna perfis sem login. Reservas de outros estabelecimentos não aparecem
no gestor da Arena Batel. Para a apresentação, reserve na Arena Batel.

## Rotas

Base: `/api`. Erros de validação retornam 400, inexistência 404, conflito/revisão antiga 409,
e quadra/conta indisponível 403.

| Método | Rota | Função |
|---|---|---|
| GET | /health | Saúde e modo de persistência |
| GET | /quadras | Catálogo com cidade, bairro, esporte, cobertura (`true`/`false`), preço, data e horário |
| GET | /quadras/:id | Detalhe e regras de preço |
| GET | /quadras/:id/horarios?data=AAAA-MM-DD | Livres, ocupados e cotação por horário |
| POST | /quadras | Adiciona quadra ao estabelecimento do gestor de demonstração |
| GET | /reservas?quadraId=... | Histórico de reservas avulsas |
| POST | /reservas | Cria uma reserva pendente de uma hora |
| PATCH | /reservas/:id/cancelar | Cancela, mantém histórico e libera horário |
| POST | /pagamentos | Confirma pagamento simulado de reserva pendente |
| POST | /checkout | Reserva e confirma múltiplos horários em uma transação |
| GET/PUT | /gestor | Estado da Arena Batel: estabelecimento, quadras, eventos, regras e mensalistas |
| GET/PUT | /admin | Contas, limites, planos, patrocínio e premissas financeiras |
| POST | /interesses | Espera/mensalista, sem envio de mensagem |
| POST | /suporte | Registra solicitação de suporte, sem envio de e-mail |

Checkout:

```json
{
  "chave": "identificador-unico-do-pedido",
  "nomeCliente": "Rafael Maluf",
  "telefoneCliente": "41999998888",
  "metodo": "pix",
  "itens": [
    {"quadraId": "1", "data": "2027-03-15", "horario": "08:00"},
    {"quadraId": "1", "data": "2027-03-15", "horario": "09:00"}
  ]
}
```

São aceitos até 24 itens do mesmo estabelecimento. Em caso de conflito, **nenhum item**
é confirmado. Repetir o mesmo pedido com a mesma chave retorna a mesma resposta sem
criar novas reservas ou pagamentos. Alterar o pedido exige uma nova chave.

O servidor calcula o valor; não aceita o preço do cliente. Regras por data prevalecem
sobre semanais e sobre o preço padrão. Reservas preservam o preço contratado.
Cancelamento pago marca `reembolso: pendente`, sem devolução real.

PUT do gestor/admin recebe o objeto retornado pelo GET, incluindo `revisao`. Uma edição
concorrente causa 409; recarregue e reaplique a mudança. Quadras devem ser pausadas e
contas revogadas, em vez de apagar histórico. Mensalistas têm vigência máxima de um ano;
as ocorrências e exceções ocupam a grade, assim como bloqueios e reservas. Ocupações
de 30 minutos possuem chave única de quadra/data/minuto no banco.

## Estrutura e testes

`server.js` inicia `src/persistence/routes.js`. A pasta `src/persistence/` reúne esquema,
repositório e regras transacionais. `src/data/seed.json` contém os exemplos iniciais.
Os services/controllers em memória da primeira entrega e `src/app.js` permanecem como
histórico e para os testes originais; **não são o caminho do servidor atual**.

```sh
npm test
```

Além dos testes originais, `test/persistencia.test.js` executa SQLite real temporário,
HTTP local, checkout concorrente, rollback, recorrências, bloqueios, cotação, limites,
revogação, revisões e persistência após fechar/reabrir. Não usa o banco de demonstração.

## Limites conscientes

- Sem autenticação/autorização de produção: os perfis são de demonstração e a API expõe
  dados do protótipo. Não publicar na Internet nem inserir dados pessoais reais.
- Pagamentos, repasses e reembolsos continuam simulados; nenhuma cobrança é realizada.
- Interesse e suporte são salvos; não há disparo automático de mensagens.
- O gestor de demonstração é fixo; criar uma conta no superadmin não abre outra sessão.
- Inteligência histórica e projeção financeira do superadmin continuam ilustrativas.
- SQLite é suficiente para a apresentação local; a escolha não equivale a validar
  arquitetura de produção, múltiplas instâncias ou escalabilidade.

## Equipe e fluxo

Rafael Gomes: base inicial da API e frontend. Rafael Maluf: redesign e fluxos atuais do
front, integração persistente, validações e testes com assistência de desenvolvimento.
Henry Mendes: protótipo/documentação. Tiago Dagnoluzzo: testes/documentação.
Erick Meister: documentação/ajustes.

Trabalhar em branches `feat/...` a partir de `develop`, PR para `develop` e integração
posterior em `main`. Commits seguem Conventional Commits, com autoria real.
Detalhes de integração: [docs/INTEGRACAO.md](docs/INTEGRACAO.md).
