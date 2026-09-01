import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';

interface TerminalViewProps {
  sessionId: string;
  isActive: boolean;
  fontSize: number;
  onReconnect?: () => void;
  onCloseTab?: () => void;
}

function TerminalView({ sessionId, isActive, fontSize, onReconnect, onCloseTab }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isInitializedRef = useRef(false);
  const isSessionStoppedRef = useRef(false);

  const handleResize = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current && isActive) {
      try {
        fitAddonRef.current.fit();
        const { cols, rows } = xtermRef.current;
        window.electronAPI.sshResize(sessionId, cols, rows);
      } catch {
        // Ignore resize errors
      }
    }
  }, [sessionId, isActive]);

  useEffect(() => {
    if (!terminalRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    const terminal = new Terminal({
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        cursorAccent: '#1a1b26',
        selectionBackground: '#33467c',
        selectionForeground: '#c0caf5',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
      fontSize,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Copy/paste support
    const pasteFromClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && !isSessionStoppedRef.current) {
          window.electronAPI.sshWrite(sessionId, text);
        }
      } catch {
        // Clipboard read may be blocked
      }
    };

    const copySelection = async () => {
      const selection = terminal.getSelection();
      if (selection) {
        try {
          await navigator.clipboard.writeText(selection);
        } catch {
          // Ignore
        }
      }
    };

    // Ctrl+C copies when there is a selection, otherwise sends SIGINT.
    // Ctrl+V (and Ctrl+Shift+V) pastes.
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      if (ctrlOrMeta && event.key.toLowerCase() === 'c' && terminal.hasSelection()) {
        copySelection();
        terminal.clearSelection();
        return false;
      }
      if (ctrlOrMeta && event.key.toLowerCase() === 'v') {
        pasteFromClipboard();
        return false;
      }
      if (ctrlOrMeta && event.shiftKey && event.key.toLowerCase() === 'c') {
        copySelection();
        return false;
      }
      return true;
    });

    // Right-click: copy selection if any, otherwise paste (MobaXterm-style)
    terminalRef.current.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (terminal.hasSelection()) {
        copySelection();
        terminal.clearSelection();
      } else {
        pasteFromClipboard();
      }
    });

    // Middle-click paste (Linux-style)
    terminalRef.current.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        pasteFromClipboard();
      }
    });

    // Send input to SSH
    terminal.onData((data) => {
      // If session is stopped, handle special keys
      if (isSessionStoppedRef.current) {
        if (data === 'r' || data === 'R') {
          onReconnect?.();
        } else if (data === '\r' || data === '\n') {
          onCloseTab?.();
        }
        return;
      }
      window.electronAPI.sshWrite(sessionId, data);
    });

    // Receive data from SSH
    const handleData = (sid: string, data: string) => {
      if (sid === sessionId) {
        terminal.write(data);
      }
    };

    const handleClosed = (sid: string) => {
      if (sid === sessionId) {
        isSessionStoppedRef.current = true;
        terminal.write('\r\n\r\n');
        terminal.write('\x1b[1;31mSession stopped\x1b[0m\r\n');
        terminal.write('   - Press \x1b[1;37m<Enter>\x1b[0m to close tab\r\n');
        terminal.write('   - Press \x1b[1;35mR\x1b[0m to reconnect\r\n');
      }
    };

    const handleError = (sid: string, error: string) => {
      if (sid === sessionId) {
        terminal.write(`\r\n\x1b[31m[Error: ${error}]\x1b[0m\r\n`);
      }
    };

    window.electronAPI.onSSHData(handleData);
    window.electronAPI.onSSHClosed(handleClosed);
    window.electronAPI.onSSHError(handleError);

    // Keyboard-interactive auth
    const handleAuthPrompt = (sid: string, prompts: any[]) => {
      if (sid !== sessionId) return;

      const responses: string[] = [];
      let currentPromptIdx = 0;

      const showNextPrompt = () => {
        if (currentPromptIdx >= prompts.length) {
          window.electronAPI.sendAuthResponse(sessionId, responses);
          promptDisposable.dispose();
          return;
        }
        const prompt = prompts[currentPromptIdx];
        terminal.write(prompt.prompt);
      };

      let inputBuffer = '';
      const promptDisposable = terminal.onData((data) => {
        if (data === '\r' || data === '\n') {
          terminal.write('\r\n');
          responses.push(inputBuffer);
          inputBuffer = '';
          currentPromptIdx++;
          showNextPrompt();
          return;
        }
        if (data === '\x7f' || data === '\b') {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            if (prompts[currentPromptIdx]?.echo !== false) {
              terminal.write('\b \b');
            }
          }
          return;
        }
        inputBuffer += data;
        if (prompts[currentPromptIdx]?.echo !== false) {
          terminal.write(data);
        }
      });

      showNextPrompt();
    };

    window.electronAPI.onSSHAuthPrompt(handleAuthPrompt);

    // Initial resize
    const { cols, rows } = terminal;
    window.electronAPI.sshResize(sessionId, cols, rows);

    // Resize observer
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      isInitializedRef.current = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.fontSize = fontSize;
    if (isActive) {
      requestAnimationFrame(() => handleResize());
    }
  }, [fontSize, isActive, handleResize]);

  useEffect(() => {
    if (isActive && xtermRef.current && fitAddonRef.current) {
      // Terminal becomes visible — refit and refresh content
      // Small delay to ensure parent element is no longer display:none
      const timer = setTimeout(() => {
        try {
          fitAddonRef.current!.fit();
          const { cols, rows } = xtermRef.current!;
          window.electronAPI.sshResize(sessionId, cols, rows);
          xtermRef.current!.refresh(0, xtermRef.current!.rows - 1);
          xtermRef.current!.focus();
        } catch {
          // Ignore
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isActive, sessionId]);

  return (
    <div
      ref={terminalRef}
      className="terminal-host relative w-full h-full min-w-0 overflow-hidden p-1"
      style={{ backgroundColor: '#1a1b26', contain: 'strict' }}
      onClick={() => xtermRef.current?.focus()}
    />
  );
}

export default TerminalView;
