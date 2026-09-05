# vtt-dnd5e - Masmorra da Vigília

Virtual Tabletop para D&D 5e. Um projeto de mesa virtual com suporte a regras PF 1e, gestão de mapa, itens, tokens e combate simplificado.

## 📋 Sobre o Projeto

O **vtt-dnd5e** é um Virtual Tabletop desenvolvido para rodar campanhas de **Pathfinder 1ª Edição** (com regras house rule de 5e). O projeto foca em:

- ✅ **Mapa dinâmico** com grid de 120×60 células
- ✅ **Tokens de personagens** e monstros com zonas de ataque
- ✅ **Itens arrastáveis** e coletáveis pelo jogador
- ✅ **Mestre (DM)** com controles completos: HP/Mana, inventário, exclusão de itens
- ✅ **Sistema de combate simplificado** sem gerenciamento complexo de iniciativa
- ✅ Interface responsiva com cursor crosshair

## ✨ Funcionalidades Principais

| Funcionalidade | Descrição |
|---|---|
| **Cursor** | Crosshair no mouse |
| **Fichas** | Cores cinza `#6b7280` |
| **Mover tokens** | Clique arrastar com botão esquerdo |
| **Excluir itens** | DM: clique direito → confirma |
| **Coletar itens** | Jogador: clique no item → toast |
| **Zona de ataque** | Círculo vermelho quando `attackRange > 0` |
| **Mapa** | 120×60 células (7680×3840 px) |
| **Números** | Em preto com contorno branco |

## 🚀 Como Rodar

```bash
# 1. Clonar o repositório
git clone https://github.com/seu-usuario/vtt-dnd5e-masmorra-da-vigilia.git

# 2. Entrar na pasta
cd vtt-dnd5e-masmorra-da-vigilia

# 3. Instalar dependências
npm install

# 4. Iniciar o projeto
npm run dev
```

O projeto iniciará dois servidores:
- **Vite (web)**: http://localhost:5173
- **Node.js (server)**: http://localhost:3001

Acesse http://localhost:5173 no navegador.

## 🛠 Tecnologias

- **Frontend**: React + Vite + PixiJS
- **Backend**: Node.js + TypeScript + WebSocket
- **Shared**: TypeScript types e eventos compartilhados

## 📦 Estrutura

```
apps/
  server/    ← API Node.js + WebSocket
  web/       ← Interface React + Vite
packages/
  shared/    ← Types e eventos compartilhados
scripts/     ✅ Smoke tests (50/50 passing)
```

## 📜 Licença

MIT - Livre para uso educacional e de campanha pessoal.

---

*Projeto em desenvolvimento ativo. Contribuir é bem-vindo!*