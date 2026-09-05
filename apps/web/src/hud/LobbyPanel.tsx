import { useState } from 'react';
import { getSocket } from '../net/socket';
import { useVttStore } from '../store';

/** Antessala NÃO bloqueante: aviso no topo enquanto o Mestre prepara a mesa.
 *  Para a Mestra, mostra também o código e o link de convite da sala. */
export function LobbyPanel() {
  const snapshot = useVttStore((s) => s.snapshot);
  const me = useVttStore((s) => s.me);
  const roomId = useVttStore((s) => s.roomId);
  const [copied, setCopied] = useState(false);
  if (!snapshot || !me || !snapshot.lobbyOpen) return null;

  const socket = getSocket();
  const inviteUrl = roomId ? `${window.location.origin}/?sala=${roomId}` : '';
  const copyInvite = (): void => {
    if (!inviteUrl) return;
    try {
      void navigator.clipboard.writeText(inviteUrl);
    } catch {
      /* fallback: usuário copia manualmente */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="lobby-banner">
      <span className="lobby-icon">🍺</span>
      <span className="lobby-text">
        <strong>Taverna do Grifo Dourado</strong>
        <span className="muted">
          {snapshot.seats.dmName} comanda a mesa · {snapshot.seats.players}/{snapshot.seats.maxPlayers} heróis ·{' '}
          {me.role === 'dm' ? 'inicie quando quiser' : 'crie seu herói e aguarde'}
        </span>
      </span>
      {me.role === 'dm' && roomId && (
        <span className="invite-box" title="Envie este link para os jogadores">
          <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" onClick={copyInvite}>
            {copied ? '✓ Copiado' : 'Copiar link'}
          </button>
        </span>
      )}
      {me.role === 'dm' && (
        <button className="btn-gold" onClick={() => socket.emit('lobby:start')}>
          Iniciar expedição
        </button>
      )}
    </div>
  );
}
