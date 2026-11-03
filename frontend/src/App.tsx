import { useEffect, useRef, useState, type FormEvent } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./App.css";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
type SSHCredentials = {
  host: string;
  username: string;
  password: string;
};

const connectionLabels: Record<ConnectionStatus, string> = {
  connecting: "Łączenie…",
  connected: "Połączono",
  disconnected: "Rozłączono",
  error: "Błąd połączenia",
};

function App() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const credentialsRef = useRef<SSHCredentials | null>(null);
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [terminalStarted, setTerminalStarted] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    credentialsRef.current = {
      host: host.trim(),
      username: username.trim(),
      password,
    };
    setTerminalStarted(true);
  };

  useEffect(() => {
    if (!terminalStarted || !terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
      theme: {
        background: "#11141b",
        foreground: "#d8dee9",
        cursor: "#8b9cff",
        selectionBackground: "#39445f",
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
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    term.focus();

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(terminalRef.current);

    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${wsProtocol}://${window.location.hostname}:8000/ws/terminal`,
    );

    ws.onopen = () => {
      setConnectionStatus("connected");
      const credentials = credentialsRef.current;
      if (credentials) {
        ws.send(JSON.stringify(credentials));
        credentialsRef.current = null;
        setPassword("");
      }
      term.writeln("Łączenie z serwerem SSH...\r\n");
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onerror = () => {
      setConnectionStatus("error");
      term.writeln("\r\nBłąd połączenia WebSocket.\r\n");
    };

    ws.onclose = () => {
      setConnectionStatus((current) =>
        current === "error" ? current : "disconnected",
      );
      term.writeln("\r\nRozłączono.\r\n");
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [terminalStarted]);

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
            <span>WORKSPACE</span>
            <span className="eyebrow-divider">/</span>
            <span>SESJA SSH</span>
          </div>
          <h1 id="page-title">Terminal w przeglądarce</h1>
          <p>Połącz się ze swoim środowiskiem i pracuj bezpośrednio z poziomu przeglądarki.</p>
        </section>

        {!terminalStarted ? (
          <section className="terminal-card login-card" aria-label="Logowanie SSH">
            <div className="terminal-toolbar">
              <div className="terminal-tab">
                <span className="tab-icon" aria-hidden="true">$_</span>
                <span>Połącz z serwerem</span>
                <span className="tab-dot" aria-hidden="true" />
              </div>
              <span className="protocol-badge">SSH</span>
            </div>
            <div className="login-surface">
              <form className="login-form" onSubmit={handleLogin}>
                <label htmlFor="ssh-host">Adres IP serwera</label>
                <input
                  id="ssh-host"
                  name="host"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="np. 192.168.1.10"
                  value={host}
                  onChange={(event) => setHost(event.target.value)}
                  required
                />

                <label htmlFor="ssh-username">Nazwa użytkownika</label>
                <input
                  id="ssh-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Użytkownik SSH"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />

                <label htmlFor="ssh-password">Hasło</label>
                <input
                  id="ssh-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Hasło SSH"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />

                <button type="submit">Połącz z serwerem</button>
                <p className="login-hint">
                  Dane logowania są przekazywane bezpośrednio do sesji i nie są zapisywane.
                </p>
              </form>
            </div>
            <footer className="terminal-footer">
              <span className="footer-endpoint">
                <span className="endpoint-icon" aria-hidden="true">⌁</span>
                localhost:8000
              </span>
              <span className="keyboard-hint">Połączenie szyfrowane przez SSH</span>
            </footer>
          </section>
        ) : (
          <section className="terminal-card" aria-label="Sesja terminalowa">
            <div className="terminal-toolbar">
              <div className="terminal-tab">
                <span className="tab-icon" aria-hidden="true">$_</span>
                <span>Sesja terminalowa</span>
                <span className="tab-dot" aria-hidden="true" />
              </div>
              <div className="toolbar-status">
                <span className="connection-badge">
                  <span className={`status-dot status-${connectionStatus}`} aria-hidden="true" />
                  <span role="status" aria-live="polite">
                    {connectionLabels[connectionStatus]}
                  </span>
                </span>
                <span className="protocol-badge">WEBSOCKET</span>
              </div>
            </div>

            <div className="terminal-surface">
              <div
                ref={terminalRef}
                className="terminal-container"
                role="region"
                aria-label="Interaktywny terminal"
              />
            </div>

            <footer className="terminal-footer">
              <span className="footer-endpoint">
                <span className="endpoint-icon" aria-hidden="true">⌁</span>
                localhost:8000
              </span>
              <span className="keyboard-hint">
                <kbd>CTRL</kbd><span>+</span><kbd>C</kbd> aby przerwać
              </span>
            </footer>
          </section>
        )}

        <div className="workspace-caption">
          <span className="caption-line" />
          <span>
            {terminalStarted
              ? "Twoja sesja terminalowa jest gotowa do pracy"
              : "Wprowadź dane logowania, aby rozpocząć sesję"}
          </span>
          <span className="caption-line" />
        </div>
      </main>
    </div>
  );
}

export default App;
