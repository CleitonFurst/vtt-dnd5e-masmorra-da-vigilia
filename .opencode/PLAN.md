# Plano: Sistema de Defesa, Histórico Expandível e Interceptação

## 1. Defesa Automática com Opt-Out (Prompt com opt-out)

### Conceito
Sempre que um ataque **acerta** em combate, o defensor recebe um prompt com 5s para tentar defender:
- **Opção 1:** "Defender (d20+DES)" → rola d20+DES vs ataque total. Se >= ataque: defendeu.
- **Opção 2:** "Não defender" → aceita o dano normalmente.

Reações existentes (Shield/Dodge/Block) continuam disponíveis **em paralelo** como opções adicionais no mesmo prompt.

### Mudanças no Server (`socket.ts`)

**`attack:declare` handler (~linha 531):**
```typescript
// ANTES: reações diferentes para hit vs miss
const availableReactions: ReactionType[] = hit
  ? [...(hasShieldSpell && hasSpellSlots ? (['shield'] as ReactionType[]) : []), 'none']
  : ['dodge', 'block', 'none'];

// DEPOIS: todas as reações disponíveis sempre, + 'defend' automático
const availableReactions: ReactionType[] = hit
  ? ['defend', ...(hasShieldSpell && hasSpellSlots ? (['shield'] as ReactionType[]) : []), 'none']
  : ['defend', 'dodge', 'block', 'none'];
```

**Novo tipo `ReactionType`:**
```typescript
export type ReactionType = 'defend' | 'shield' | 'dodge' | 'block' | 'none';
```

**`resolveReaction` — novo branch para `defend`:**
```typescript
} else if (reaction === 'defend') {
  // Rola d20 + DES vs attackTotal
  const defSheet = room.sheets.find((s) => s.tokenId === defender.id);
  let dexModVal: number;
  if (defSheet) {
    dexModVal = abilityMod(defSheet.abilities.dex);
  } else {
    const srdM = SRD_MONSTERS.find((m) => m.name === defender.name);
    dexModVal = srdM?.abil ? abilityMod(srdM.abil.dex) : 0;
  }
  const mode: 'normal' | 'adv' = pr.advantage ? 'adv' : 'normal';
  const defRoll = rollD20Check(mode);
  const defTotal = defRoll.total + dexModVal;
  finalHit = defTotal < pr.attackTotal;
  if (combatant) combatant.reactionsRemaining -= 1;
  io.to(room.id).emit('chat:message', {
    id: uid('msg'),
    from: 'Masmoura',
    text: `${defender.name} defendeu (${defRoll.total}+${dexModVal}=${defTotal} vs ${pr.attackTotal}) — ${finalHit ? 'acertou!' : 'defendeu!'}`,
    ts: Date.now(),
  });
}
```

### Mudanças no Client

**`ReactionPrompt.tsx`:**
- Adicionar botão "Defender (d20+DES)" com prioridade (primeiro da lista)
- Label: `🛡 Defensa (d20+DES)`
- Todos os botões existentes continuam disponíveis
- Quando `hit === true`: mostrar "Defender", "Escudo" (se disponível), "Nenhuma"
- Quando `hit === false`: mostrar "Defender", "Esquivar", "Bloquear", "Nenhuma"

---

## 2. Histórico Expandível/Colapsável

### Mudanças no Store (`store.ts`)
```typescript
// Novo campo
historyExpanded: boolean;
setHistoryExpanded(v: boolean): void;
// Default: true (aberto)
```

### Mudanças no `AttackHistory.tsx`
- Adicionar botão toggle no header: `◀` (aberto) / `▶` (fechado)
- Quando colapsado: mostra só o botão toggle (largura ~36px)
- Quando expandido: mostra o painel completo (260px)
- Animação CSS: `transition: width 0.2s ease, opacity 0.15s ease`
- Click no toggle → `setHistoryExpanded(!current)`

### CSS
```css
.attack-history {
  width: 36px;          /* colapsado */
  transition: width 0.2s ease;
}
.attack-history.expanded {
  width: 260px;         /* expandido */
}
.ah-toggle { cursor: pointer; font-size: 16px; }
.ah-list { opacity: 0; pointer-events: none; transition: opacity 0.15s; }
.attack-history.expanded .ah-list { opacity: 1; pointer-events: auto; }
```

---

## 3. Interceptação de Ataque (Proteger Aliado)

### Conceito
Quando um ataque é declarado contra um jogador, **outro jogador adjacente** (≤2 células) pode usar sua reação para:
- Receber o dano no lugar do aliado original
- O atacante rola contra a CA do protetor em vez do alvo original

### Novo tipo `ReactionType`
```typescript
export type ReactionType = 'defend' | 'shield' | 'dodge' | 'block' | 'intercept' | 'none';
```

### Mudanças no Server

**`PendingReaction` — campos extras:**
```typescript
export interface PendingReaction {
  // ... existente ...
  interceptable: boolean;        // true se há aliados adjacentes
  potentialProtectors: string[]; // ids de tokens adjacentes ao alvo que são jogadores
}
```

**`attack:declare` — detectar protetores potenciais:**
```typescript
// Após definir availableReactions, antes de montar pendingReaction:
const potentialProtectors = room.tokens
  .filter(t => t.id !== attacker.id && t.id !== target.id && t.kind === 'pc' && !t.dead
    && tokenDistanceCells(t, target, room.map.cellSize) <= 2
    && room.combat.order.find(c => c.tokenId === t.id)?.reactionsRemaining! > 0)
  .map(t => t.id);

const interceptable = potentialProtectors.length > 0;

// Adicionar 'intercept' nas reações do PROTETOR (não do alvo)
// O prompt de interceptação é mostrado para CADA protetor potencial
```

**`PendingReaction` — adicionar campo:**
```typescript
interface PendingReaction {
  // ... existente ...
  interceptable: boolean;
  potentialProtectors: string[];
}
```

**Novo handler `defense:intercept`:**
```typescript
socket.on('defense:intercept', ({ protectorTokenId }) => {
  const room = roomOf();
  if (!room || !room.combat.pendingReaction) return;
  
  const pr = room.combat.pendingReaction;
  const protector = room.tokens.find(t => t.id === protectorTokenId);
  if (!protector || protector.dead) return;
  
  // Verificar que é aliado (jogador controla)
  const protSheet = room.sheets.find(s => s.tokenId === protector.id);
  if (!protSheet || (protSheet.ownerId !== socket.data.playerId && !isDm())) return;
  
  // Verificar reação disponível
  const protCombatant = room.combat.order.find(c => c.tokenId === protector.id);
  if (!protCombatant || protCombatant.reactionsRemaining <= 0) {
    socket.emit('error', `${protector.name} já usou sua reação.`);
    return;
  }
  
  // Verificar adjacência
  const target = room.tokens.find(t => t.id === pr.targetTokenId);
  if (!target || tokenDistanceCells(protector, target, room.map.cellSize) > 2) return;
  
  // Trocar alvo: dano vai para o protetor
  pr.targetTokenId = protector.id; // redireciona dano
  protCombatant.reactionsRemaining -= 1;
  
  io.to(room.id).emit('chat:message', {
    id: uid('msg'),
    from: 'Masmoura',
    text: `${protector.name} interceptou o ataque de ${room.tokens.find(t => t.id === pr.attackerTokenId)?.name}! Dano redirecionado.`,
    ts: Date.now(),
  });
  
  // Continuar resolução normal (reação do novo alvo)
  broadcastCombat(room, io);
});
```

**`defense:declare` — Adaptar para mostrar reações do protetor também:**
- Quando `pr.interceptable` e o jogador controla um protetor potencial, mostrar prompt com opção "Interceptar"

### Mudanças no Client

**`ReactionPrompt.tsx`:**
- Detectar se o jogador controla algum dos `potentialProtectors`
- Se sim, mostrar botão "🛡 Interceptar (proteger aliado)" com destaque
- Ao clicar: emitir `defense:intercept` em vez de `defense:declare`

**`events.ts`:**
```typescript
// Novo evento client→server
'defense:intercept': (req: { protectorTokenId: string }) => void;
```

**`types.ts`:**
```typescript
// ReactionType estendido
export type ReactionType = 'defend' | 'shield' | 'dodge' | 'block' | 'intercept' | 'none';

// PendingReaction estendido
export interface PendingReaction {
  // ... existente ...
  interceptable: boolean;
  potentialProtectors: string[];
}
```

---

## Arquivos para modificar

### shared
1. `packages/shared/src/types.ts`: `ReactionType` (+defend, +intercept), `PendingReaction` (+interceptable, +potentialProtectors)
2. `packages/shared/src/events.ts`: `defense:intercept` event

### server
3. `apps/server/src/socket.ts`: 
   - `attack:declare`: detectar protetores potenciais, popular campos extras
   - `resolveReaction`: novo branch para `defend`
   - Novo handler `defense:intercept`

### client
4. `apps/web/src/store.ts`: `historyExpanded` state
5. `apps/web/src/net/socket.ts`: handler `defense:intercept` (se necessário)
6. `apps/web/src/hud/ReactionPrompt.tsx`: botão "Defender", botão "Interceptar", lógica de exibição
7. `apps/web/src/hud/AttackHistory.tsx`: toggle expand/collapse
8. `apps/web/src/styles.css`: `.attack-history` toggle animation
9. `apps/web/src/App.tsx`: passar `historyExpanded` como prop se necessário

---

## Verificação
- Typecheck passa
- Smoke tests passam
- Ataque em combate → prompt aparece com "Defender" + reações
- Defesa automática funciona (d20+DES vs ataque)
- Interceptação funciona (dano redirecionado)
- Histórico expande/colapsa com animação
