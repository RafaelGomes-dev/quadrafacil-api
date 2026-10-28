// Ferramenta de preparação: reutiliza a base visual existente, sem dependência em runtime.
import { writeFileSync } from 'node:fs';
import { dadosIniciais } from '../../quadrafacil-frontend/src/gestor/model.js';
import { contasIniciais } from '../../quadrafacil-frontend/src/superadmin/model.js';
import { gerarQuadrasCatalogo } from '../../quadrafacil-frontend/src/services/catalogoDemo.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { quadras } = require('../src/data/mockData.js');
const gestor = dadosIniciais();
const admin = contasIniciais();
const extras = quadras.filter(q => !gestor.quadras.some(a => a.id === q.id)).map(q => ({
  ...q, estabelecimentoId: `quadra-${q.id}`, estabelecimentoNome: q.nome, ativa: true,
}));
writeFileSync(new URL('../src/data/seed.json', import.meta.url), JSON.stringify({
  gestor, admin, outrasQuadras: [...extras, ...gerarQuadrasCatalogo(admin.contas)],
}, null, 2) + '\n');
