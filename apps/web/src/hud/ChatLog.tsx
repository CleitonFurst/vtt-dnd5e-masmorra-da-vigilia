import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../net/socket';
import { useVttStore } from '../store';

export function ChatLog() {
  const chat = useVttStore((s) => s.snapshot?.chat ?? []);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const socket = getSocket();

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat]);

  return (
    <div className="panel chat">
      <div className="panel-head">
        <strong>Chat &amp; Log</strong>
      </div>
      <ul className="chat-list" ref={listRef}>
        {chat.map((m) => (
          <li key={m.id}>
            <strong>{m.from}:</strong> {m.text}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) {
            socket.emit('chat:send', text);
            setText('');
          }
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem..." maxLength={500} />
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
}
