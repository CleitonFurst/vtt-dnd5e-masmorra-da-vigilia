import { useEffect, useRef, useState } from 'react';
import { createRoom, joinRoom } from '../net/socket';
import { useVttStore } from '../store';

/** Entrada automática para testes/demonstrações: ?auto=dm:Nome ou ?auto=player:Nome */
function autoJoinParam(): string | null {
  const p = new URLSearchParams(window.location.search).get('auto');
  return p && /^(dm|player):.+$/i.test(p) ? p : null;
}

function salaParam(): string {
  return (new URLSearchParams(window.location.search).get('sala') ?? '').trim().toUpperCase().slice(0, 16);
}

export function JoinGate() {
  const [name, setName] = useState('');
  const [want, setWant] = useState<'dm' | 'player'>('player');
  const [sala, setSala] = useState(salaParam());
  const joining = useVttStore((s) => s.joining);
  const error = useVttStore((s) => s.joinError);
  const fired = useRef(false);

  useEffect(() => {
    const auto = autoJoinParam();
    if (!auto || fired.current) return;
    fired.current = true;
    const idx = auto.indexOf(':');
    const role = auto.slice(0, idx).toLowerCase() as 'dm' | 'player';
    const code = salaParam();
    void joinRoom(auto.slice(idx + 1), role, code || undefined);
  }, []);

  const submit = async (): Promise<void> => {
    if (want === 'dm' && !sala.trim()) {
      // Mestra sem código: cria uma sala nova e entra nela
      useVttStore.getState().setJoining(true);
      const code = await createRoom();
      if (!code) {
        useVttStore.getState().setJoinError('Não foi possível criar a sala. Tente novamente.');
        return;
      }
      setSala(code);
      await joinRoom(name, 'dm', code);
      return;
    }
    await joinRoom(name, want, sala.trim() ? sala.trim().toUpperCase() : undefined);
  };

  return (
    <div className="overlay">
      <form
        className="panel join"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h1>Masmoura da Vigília</h1>
        <p className="tagline">Uma aventura tática para 1 Mestre e até 4 heróis</p>
        <label>
          Seu nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Ana"
            maxLength={24}
            required
            autoFocus
          />
        </label>
        <div className="role-pick">
          <button
            type="button"
            className={`role-btn ${want === 'player' ? 'on' : ''}`}
            onClick={() => setWant('player')}
          >
            <strong>Herói</strong>
            <span>jogue na aventura (4 vagas)</span>
          </button>
          <button type="button" className={`role-btn ${want === 'dm' ? 'on' : ''}`} onClick={() => setWant('dm')}>
            <strong>Mestre</strong>
            <span>conduz a masmoura (1 vaga)</span>
          </button>
        </div>

        {want === 'dm' ? (
          <p className="hint center">
            Sem código? Ao entrar, uma <strong>sala nova</strong> será criada com link de convite.
            Já tem uma sala aberta? Informe o código abaixo.
          </p>
        ) : null}
        <label className={want === 'player' || sala.trim() ? '' : 'optional'}>
          Código da sala {want === 'dm' ? '(opcional — vazio cria sala nova)' : ''}
          <input
            value={sala}
            onChange={(e) => setSala(e.target.value.toUpperCase())}
            placeholder="Ex.: K7M2X"
            maxLength={16}
            spellCheck={false}
          />
        </label>

        <button type="submit" disabled={joining}>
          {joining
            ? 'Conectando…'
            : want === 'dm'
              ? sala.trim()
                ? 'Entrar nessa sala como Mestre'
                : 'Criar sala e começar'
              : 'Entrar como herói'}
        </button>
        {error && <p className="error">{error}</p>}
        <p className="hint">
          A Mestra cria a sala e compartilha o link de convite; cada jogador entra pelo link ou digitando o código.
        </p>
      </form>
    </div>
  );
}
