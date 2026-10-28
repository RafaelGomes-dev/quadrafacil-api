require('dotenv').config();

const { criarAppPersistente } = require('./src/persistence/routes');
const app = criarAppPersistente();

const PORT = process.env.PORT || 3001;

app.listen(PORT, '127.0.0.1', () => {
  console.log(`QuadraFacil API rodando na porta ${PORT}`);
});
