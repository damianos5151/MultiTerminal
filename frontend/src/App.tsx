import { useEffect, useRef, useState, type FormEvent } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./App.css";

type HostStatus = "connecting" | "connected" | "disconnected" | "error";

type HostSession = {
  ip: string;
  port: number;
  status: HostStatus;
};

type HostResponse = {
  ip_address: string;
};

type ServerMessage = {
  type: "status" | "output" | "error";
  host?: string;
  port?: number;
  status?: HostStatus;
  data?: string;
  message?: string;
};

const apiBaseUrl = `http://${window.location.hostname}:8000/api/v1`;
const sessionKey = (ip: string, port: number) => `${ip}:${port}`;

const statusLabels: Record<HostStatus, string> = {
  connecting: "Łączenie…",
  connected: "Połączono",
  disconnected: "Rozłączono",
  error: "Błąd polecenia",
};

type HostTerminalProps = {
  host: string;
  port: number;
  terminalKey: string;
  active: boolean;
  onInput: (host: string, port: number, data: string) => void;
  onReady: (terminalKey: string, terminal: Terminal) => void;
  onDispose: (terminalKey: string, terminal: Terminal) => void;
};

function HostTerminal({ host, port, terminalKey, active, onInput, onReady, onDispose }: HostTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const callbacksRef = useRef({ onInput, onReady, onDispose });

  useEffect(() => {
    callbacksRef.current = { onInput, onReady, onDispose };
  }, [onInput, onReady, onDispose]);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
      scrollback: 3000,
      theme: {
        background: "#101318",
        foreground: "#d8dee9",
        cursor: "#69c6a5",
        selectionBackground: "#34434a",
        black: "#282c34",
        red: "#e06c75",
        green: "#98c379",
        yellow: "#e5c07b",
        blue: "#61afef",
        magenta: "#c678dd",
        cyan: "#56b6c2",
        white: "#abb2bf",
        brightBlack: "#5c6370",
        brightRed: "#e06c75",
        brightGreen: "#98c379",
        brightYellow: "#e5c07b",
        brightBlue: "#61afef",
        brightMagenta: "#c678dd",
        brightCyan: "#56b6c2",
        brightWhite: "#ffffff",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    callbacksRef.current.onReady(terminalKey, terminal);

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);
    const inputSubscription = terminal.onData((data) => {
      callbacksRef.current.onInput(host, port, data);
    });

    return () => {
      resizeObserver.disconnect();
      inputSubscription.dispose();
      callbacksRef.current.onDispose(terminalKey, terminal);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [host, port, terminalKey]);

  useEffect(() => {
    if (!active || !terminalRef.current) return;
    const frame = requestAnimationFrame(() => {
      fitAddonRef.current?.fit();
      terminalRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div
      ref={containerRef}
      className={`host-terminal${active ? " is-active" : ""}`}
      role="region"
      aria-label={`Terminal hosta ${host}:${port}`}
      aria-hidden={!active}
    />
  );
}

function App() {
  const socketRef = useRef<WebSocket | null>(null);
  const pendingMessagesRef = useRef<string[]>([]);
  const terminalMapRef = useRef(new Map<string, Terminal>());
  const pendingOutputRef = useRef(new Map<string, string[]>());
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [terminalStarted, setTerminalStarted] = useState(false);
  const [hosts, setHosts] = useState<HostSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [command, setCommand] = useState("");
  const [availableHosts, setAvailableHosts] = useState<string[]>([]);
  const [scanMessage, setScanMessage] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHosts = async (): Promise<string[]> => {
    const response = await fetch(`${apiBaseUrl}/hosts`);
    if (!response.ok) {
      throw new Error("Nie udało się pobrać listy hostów.");
    }

    const hosts: HostResponse[] = await response.json();
    const ipAddresses = hosts.map(({ ip_address }) => ip_address);
    setAvailableHosts(ipAddresses);
    return ipAddresses;
  };

  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      socketRef.current?.close();
    };
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    setScanMessage("Uruchamianie skanowania sieci…");

    try {
      const response = await fetch(`${apiBaseUrl}/scan`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Nie udało się uruchomić skanowania sieci.");
      }

      setScanMessage("Skanowanie uruchomione. Odświeżanie listy za 3 sekundy…");
      scanTimeoutRef.current = setTimeout(() => {
        void fetchHosts()
          .then((ips) =>
            setScanMessage(
              ips.length
                ? `Hosty znalezione/zapisane (${ips.length}): ${ips.join(", ")}`
                : "Nie znaleziono hostów z aktywnym SSH (port 22). Sprawdź SCAN_SUBNET; urządzenia bez SSH nie zostaną wykryte.",
            ),
          )
          .catch((error: unknown) => {
            setScanMessage(
              error instanceof Error
                ? error.message
                : "Nie udało się odświeżyć listy hostów.",
            );
          })
          .finally(() => setIsScanning(false));
      }, 3000);
    } catch (error) {
      setIsScanning(false);
      setScanMessage(
        error instanceof Error
          ? error.message
          : "Nie udało się uruchomić skanowania sieci.",
      );
    }
  };

  const handleConnect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ip = host.trim();
    const sshPort = Number(port);
    if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) {
      setNotice("Port SSH musi być liczbą z zakresu 1–65535.");
      return;
    }
    const existing = hosts.find((session) => session.ip === ip && session.port === sshPort);
    if (existing?.status === "connected" || existing?.status === "connecting") {
      setNotice(`Host ${ip}:${sshPort} ma już aktywne połączenie.`);
      return;
    }

    setHosts((current) => {
      const next = current.filter((session) => session.ip !== ip || session.port !== sshPort);
      return [...next, { ip, port: sshPort, status: "connecting" }];
    });
    setTerminalStarted(true);
    setNotice("");

    const payload = JSON.stringify({
      action: "connect",
      host: ip,
      port: sshPort,
      username: username.trim(),
      password,
    });
    let socket = socketRef.current;
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${wsProtocol}://${window.location.hostname}:8000/ws/terminal`);
      socketRef.current = socket;
      socket.onopen = () => {
        for (const queuedMessage of pendingMessagesRef.current.splice(0)) {
          socket?.send(queuedMessage);
        }
      };
      socket.onmessage = (messageEvent) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(messageEvent.data) as ServerMessage;
        } catch {
          setNotice("Otrzymano nieprawidłową odpowiedź serwera.");
          return;
        }

        if (message.type === "status" && message.host && message.port && message.status) {
          setHosts((current) => {
            const found = current.some((session) => session.ip === message.host && session.port === message.port);
            if (!found) return [...current, { ip: message.host!, port: message.port!, status: message.status! }];
            return current.map((session) =>
              session.ip === message.host && session.port === message.port
                ? { ...session, status: message.status! }
                : session,
            );
          });
          if (message.status === "connected") {
            setActiveSessionId((current) => current ?? sessionKey(message.host!, message.port!));
          }
        } else if (message.type === "output" && message.host && message.port && message.data) {
          const key = sessionKey(message.host, message.port);
          const terminal = terminalMapRef.current.get(key);
          if (terminal) {
            terminal.write(message.data);
          } else {
            const queuedOutput = pendingOutputRef.current.get(key) ?? [];
            queuedOutput.push(message.data);
            pendingOutputRef.current.set(key, queuedOutput);
          }
        } else if (message.type === "error") {
          setNotice(message.message ?? "Wystąpił błąd połączenia.");
          if (message.host && message.port) {
            setHosts((current) => current.map((session) =>
              session.ip === message.host && session.port === message.port
                ? { ...session, status: "error" }
                : session,
            ));
          }
        }
      };
      socket.onerror = () => setNotice("Błąd połączenia WebSocket.");
      socket.onclose = () => {
        setHosts((current) => current.map((session) =>
          session.status === "connecting" || session.status === "connected"
            ? { ...session, status: "disconnected" }
            : session,
        ));
        if (socketRef.current === socket) socketRef.current = null;
      };
    }

    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    else pendingMessagesRef.current.push(payload);
    setPassword("");
  };

  const handleTerminalReady = (key: string, terminal: Terminal) => {
    terminalMapRef.current.set(key, terminal);
    for (const output of pendingOutputRef.current.get(key) ?? []) terminal.write(output);
    pendingOutputRef.current.delete(key);
  };

  const handleTerminalDispose = (key: string, terminal: Terminal) => {
    if (terminalMapRef.current.get(key) === terminal) terminalMapRef.current.delete(key);
  };

  const sendTerminalInput = (ip: string, sshPort: number, data: string) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: "input", host: ip, port: sshPort, data }));
    }
  };

  const handleCommand = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      setNotice("Brak aktywnego połączenia WebSocket.");
      return;
    }
    socket.send(JSON.stringify({ action: "command", target: "all", command: value }));
    setCommand("");
    setNotice("");
  };

  const connectedCount = hosts.filter((session) => session.status === "connected").length;
  const activeSession = hosts.find((session) => sessionKey(session.ip, session.port) === activeSessionId);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="MultiTerminal — strona główna">
          <span className="brand-mark" aria-hidden="true">
            <span>›_</span>
          </span>
          <span className="brand-name">multi<span>terminal</span></span>
        </a>
        <div className="topbar-context">
          <span className="context-indicator" aria-hidden="true" />
          <span>Środowisko lokalne</span>
        </div>
      </header>

      <main className="workspace">
        <section className="page-intro" aria-labelledby="page-title">
          <div className="eyebrow">
            <span>INFRASTRUCTURE</span>
            <span className="eyebrow-divider">/</span>
            <span>SSH CONTROL ROOM</span>
          </div>
          <div className="page-heading-row">
            <div>
              <h1 id="page-title">Fleet terminal</h1>
              <p>Sesje SSH i diagnostyka hostów w jednym miejscu.</p>
            </div>
            <div className="fleet-counter" aria-live="polite">
              <span className="counter-dot" />
              <strong>{connectedCount}</strong> / {hosts.length} aktywnych
            </div>
          </div>
        </section>

        {!terminalStarted ? (
          <section className="connect-empty">
            <div className="empty-glyph" aria-hidden="true">$_</div>
            <div className="empty-copy">
              <span className="section-kicker">NOWA SESJA</span>
              <h2>Połącz pierwszy host</h2>
              <p>Dodaj adres IP i dane SSH, aby otworzyć terminal.</p>
            </div>
            <form className="connect-form connect-form-first" onSubmit={handleConnect}>
              <label htmlFor="ssh-host">Adres IP</label>
              <input id="ssh-host" list="hosts-list" type="text" inputMode="url" placeholder="192.168.1.10" value={host} onChange={(event) => setHost(event.target.value)} required />
              <label htmlFor="ssh-port">Port SSH</label>
              <input id="ssh-port" type="number" min="1" max="65535" value={port} onChange={(event) => setPort(event.target.value)} required />
              <datalist id="hosts-list">
                {availableHosts.map((ip) => <option key={ip} value={ip} />)}
              </datalist>
              <button className="scan-button" type="button" onClick={() => void handleScan()} disabled={isScanning}>
                {isScanning ? "Skanowanie…" : "Skanuj sieć"}
              </button>
              {scanMessage && <p className="form-message" role="status">{scanMessage}</p>}
              <label htmlFor="ssh-username">Użytkownik</label>
              <input id="ssh-username" type="text" autoComplete="username" placeholder="Użytkownik SSH" value={username} onChange={(event) => setUsername(event.target.value)} required />
              <label htmlFor="ssh-password">Hasło</label>
              <input id="ssh-password" type="password" autoComplete="current-password" placeholder="Hasło SSH" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button className="primary-button" type="submit">Połącz przez SSH <span aria-hidden="true">↗</span></button>
              <p className="form-message">Dane logowania nie są zapisywane.</p>
            </form>
            {notice && <p className="notice-message" role="status">{notice}</p>}
          </section>
        ) : (
          <div className="control-room">
            <section className="detail-column" aria-label="Aktywny terminal">
              <div className="terminal-card">
                <header className="terminal-toolbar">
                  <div className="terminal-tab">
                    <span className="tab-icon" aria-hidden="true">$_</span>
                    <span>{activeSession ? `${activeSession.ip}:${activeSession.port}` : "Wybierz host"}</span>
                    {activeSession && <span className={`status-dot status-${activeSession.status}`} aria-hidden="true" />}
                  </div>
                  <span className="protocol-badge">SSH / INTERACTIVE</span>
                </header>
                <div className="terminal-surface">
                  {hosts.map((session) => (
                    <HostTerminal
                      key={sessionKey(session.ip, session.port)}
                      host={session.ip}
                      port={session.port}
                      terminalKey={sessionKey(session.ip, session.port)}
                      active={sessionKey(session.ip, session.port) === activeSessionId}
                      onInput={sendTerminalInput}
                      onReady={handleTerminalReady}
                      onDispose={handleTerminalDispose}
                    />
                  ))}
                  {hosts.length === 0 && <div className="terminal-empty">Oczekiwanie na połączenie…</div>}
                </div>
                <footer className="terminal-footer">
                  <span>{activeSession ? `${activeSession.ip}:${activeSession.port}` : "Brak aktywnego hosta"}</span>
                  <span><kbd>CTRL</kbd> + <kbd>C</kbd> przerwij</span>
                </footer>
              </div>

              <form className="command-bar" onSubmit={handleCommand}>
                <div className="command-prompt" aria-hidden="true">ALL <span>›</span></div>
                <input
                  aria-label="Polecenie wysyłane dla wszystkich hostów"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="Wpisz komendę i naciśnij Enter…"
                  disabled={connectedCount === 0}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="command-target">{connectedCount} host{connectedCount === 1 ? "" : "y"}</span>
                <button type="submit" aria-label="Wyślij polecenie" disabled={connectedCount === 0 || !command.trim()} title="Wyślij do wszystkich hostów">↵</button>
              </form>
              {notice && <p className="notice-message" role="status">{notice}</p>}
            </section>

            <aside className="host-sidebar" aria-label="Połączone hosty">
              <div className="sidebar-heading">
                <div>
                  <span className="section-kicker">SESSIONS</span>
                  <h2>Połączenia</h2>
                </div>
                <span className="host-count">{hosts.length.toString().padStart(2, "0")}</span>
              </div>

              <div className="host-list" role="list">
                {hosts.map((session, index) => (
                  <button
                    className={`host-row${sessionKey(session.ip, session.port) === activeSessionId ? " is-selected" : ""}`}
                    key={sessionKey(session.ip, session.port)}
                    type="button"
                    onClick={() => setActiveSessionId(sessionKey(session.ip, session.port))}
                    role="listitem"
                    aria-current={sessionKey(session.ip, session.port) === activeSessionId ? "true" : undefined}
                  >
                    <span className={`host-status status-${session.status}`} aria-hidden="true" />
                    <span className="host-details">
                      <strong>{session.ip}:{session.port}</strong>
                      <small>{statusLabels[session.status]}</small>
                    </span>
                    <span className="host-index">{String(index + 1).padStart(2, "0")}</span>
                  </button>
                ))}
                {hosts.length === 0 && <p className="sidebar-empty">Brak aktywnych sesji.</p>}
              </div>

              <form className="connect-form connect-form-side" onSubmit={handleConnect}>
                <span className="section-kicker">DODAJ HOST</span>
                <label htmlFor="add-host">Adres IP</label>
                <input id="add-host" list="hosts-list" type="text" inputMode="url" placeholder="192.168.1.11" value={host} onChange={(event) => setHost(event.target.value)} required />
                <label htmlFor="add-port">Port SSH</label>
                <input id="add-port" type="number" min="1" max="65535" value={port} onChange={(event) => setPort(event.target.value)} required />
                <label htmlFor="add-username">Użytkownik SSH</label>
                <input id="add-username" type="text" placeholder="Użytkownik" value={username} onChange={(event) => setUsername(event.target.value)} required />
                <label htmlFor="add-password">Hasło SSH</label>
                <input id="add-password" type="password" placeholder="Hasło" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button className="secondary-button" type="submit">+ <span>Połącz host</span></button>
              </form>
              <p className="sidebar-footnote">Terminal wejściowy kierowany jest wyłącznie do wybranego hosta.</p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
