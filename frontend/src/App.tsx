import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./App.css";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

const connectionLabels: Record<ConnectionStatus, string> = {
  connecting: "Łączenie…",
  connected: "Połączono",
  disconnected: "Rozłączono",
  error: "Błąd połączenia",
};

function App() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  useEffect(() => {
    if (!terminalRef.current) return;

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

    const ws = new WebSocket("ws://localhost:8000/ws/terminal");

    ws.onopen = () => {
      setConnectionStatus("connected");
      term.writeln("Połączono z backendem. Trwa łączenie SSH...\r\n");
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
  }, []);

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

        <div className="workspace-caption">
          <span className="caption-line" />
          <span>Twoja sesja terminalowa jest gotowa do pracy</span>
          <span className="caption-line" />
        </div>
      </main>
    </div>
  );
}

export default App;
