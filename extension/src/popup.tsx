import { useEffect, useState } from "react"

import { saveEntry } from "./lib/api"
import { getSession, login, logout, type User } from "./lib/auth"

function IndexPopup() {
  const [user, setUser] = useState<User | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    getSession().then((session) => {
      setUser(session?.user ?? null)
      setLoadingSession(false)
    })
  }, [])

  return (
    <Shell>
      {loadingSession ? (
        <p className="db-loading">Loading…</p>
      ) : user ? (
        <SaveForm />
      ) : (
        <LoginForm onLoggedIn={(u) => setUser(u)} />
      )}
    </Shell>
  )
}

function Mark() {
  return (
    <svg
      className="db-mark"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--db-accent)" />
      <circle cx="8" cy="9" r="2" fill="var(--db-accent-contrast)" />
      <circle cx="16" cy="9" r="2" fill="var(--db-accent-contrast)" />
      <circle cx="12" cy="16" r="2" fill="var(--db-accent-contrast)" />
      <path
        d="M8 9L12 16M16 9L12 16"
        stroke="var(--db-accent-contrast)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="db-popup">
      <header className="db-header">
        <Mark />
        <span className="db-wordmark">devbrain</span>
      </header>
      {children}
      <Styles />
    </div>
  )
}

function LoginForm({ onLoggedIn }: { onLoggedIn: (user: User) => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const session = await login(email, password)
      onLoggedIn(session.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="db-form" onSubmit={handleLogin}>
      <div className="db-field">
        <label className="db-label" htmlFor="db-login-email">
          Email
        </label>
        <input
          id="db-login-email"
          className="db-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="db-field">
        <label className="db-label" htmlFor="db-login-password">
          Password
        </label>
        <input
          id="db-login-password"
          className="db-input"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="db-error">{error}</p>}

      <button className="db-button" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p className="db-hint">Uses your devbrain account.</p>
    </form>
  )
}

function SaveForm() {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  )
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.title) setTitle(tab.title)
      if (tab?.url) setSourceUrl(tab.url)

      if (tab?.id) {
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection()?.toString() ?? ""
          })
          .then(([result]) => {
            if (result?.result) setContent(result.result as string)
          })
          .catch(() => {})
      }
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setStatus("saving")
    try {
      await saveEntry({ title, content, sourceUrl: sourceUrl || undefined })
      setStatus("saved")
      setTimeout(() => window.close(), 800)
    } catch (err) {
      setStatus("error")
      setErrorMessage(err instanceof Error ? err.message : "Save failed")
    }
  }

  return (
    <form className="db-form" onSubmit={handleSave}>
      <div className="db-field">
        <label className="db-label" htmlFor="db-save-title">
          Title
        </label>
        <input
          id="db-save-title"
          className="db-input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="db-field">
        <label className="db-label" htmlFor="db-save-content">
          Content
        </label>
        <textarea
          id="db-save-content"
          className="db-input db-textarea"
          placeholder="What do you want to remember?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          required
        />
      </div>

      <div className="db-field">
        <label className="db-label" htmlFor="db-save-url">
          Link <span className="db-label-optional">(optional)</span>
        </label>
        <input
          id="db-save-url"
          className="db-input"
          placeholder="https://…"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
      </div>

      {status === "error" && <p className="db-error">{errorMessage}</p>}

      <button
        className="db-button"
        type="submit"
        disabled={status === "saving"}>
        {status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Saved ✓"
            : "Save"}
      </button>
    </form>
  )
}

function Styles() {
  return (
    <style>{`
      .db-popup {
        --db-accent: #6366f1;
        --db-accent-hover: #7678f5;
        --db-accent-active: #5254d1;
        --db-accent-contrast: #ffffff;
        --db-bg: #17181c;
        --db-surface: #1f2127;
        --db-border: #2a2d35;
        --db-border-hover: #383c46;
        --db-ink: #f1f2f4;
        --db-ink-muted: #9a9ea7;
        --db-danger: #f87171;
        --db-radius: 8px;
        --db-font: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        --db-gap-xs: 4px;
        --db-gap-sm: 8px;
        --db-gap-md: 12px;
        --db-gap-lg: 16px;

        width: 340px;
        min-height: 420px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: var(--db-gap-md);
        padding: var(--db-gap-lg);
        background: var(--db-bg);
        color: var(--db-ink);
        font-family: var(--db-font);
        font-size: 14px;
        line-height: 1.4;
      }

      @media (prefers-color-scheme: light) {
        .db-popup {
          --db-accent: #4f46e5;
          --db-accent-hover: #6058ea;
          --db-accent-active: #4338ca;
          --db-accent-contrast: #ffffff;
          --db-bg: #ffffff;
          --db-surface: #f7f7f9;
          --db-border: #e2e3e8;
          --db-border-hover: #cfd1d9;
          --db-ink: #17181c;
          --db-ink-muted: #6b6f78;
          --db-danger: #dc2626;
        }
      }

      .db-popup * {
        box-sizing: border-box;
      }

      .db-header {
        display: flex;
        align-items: center;
        gap: var(--db-gap-sm);
      }

      .db-mark {
        flex-shrink: 0;
      }

      .db-wordmark {
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .db-loading {
        margin: 0;
        color: var(--db-ink-muted);
        font-size: 13px;
      }

      .db-form {
        display: flex;
        flex-direction: column;
        gap: var(--db-gap-md);
      }

      .db-field {
        display: flex;
        flex-direction: column;
        gap: var(--db-gap-xs);
      }

      .db-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--db-ink-muted);
      }

      .db-label-optional {
        font-weight: 400;
        text-transform: none;
      }

      .db-input {
        width: 100%;
        background: var(--db-surface);
        border: 1px solid var(--db-border);
        border-radius: var(--db-radius);
        color: var(--db-ink);
        font-family: inherit;
        font-size: 13px;
        padding: 8px 10px;
        transition: border-color 120ms ease, background 120ms ease;
      }

      .db-input::placeholder {
        color: var(--db-ink-muted);
      }

      .db-input:hover {
        border-color: var(--db-border-hover);
      }

      .db-input:focus-visible {
        outline: none;
        border-color: var(--db-accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--db-accent) 30%, transparent);
      }

      .db-textarea {
        resize: vertical;
        min-height: 96px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12.5px;
        line-height: 1.5;
      }

      .db-button {
        appearance: none;
        border: none;
        border-radius: var(--db-radius);
        background: var(--db-accent);
        color: var(--db-accent-contrast);
        font-family: inherit;
        font-size: 13.5px;
        font-weight: 600;
        padding: 9px 14px;
        cursor: pointer;
        transition: background 120ms ease, transform 60ms ease;
      }

      .db-button:hover:not(:disabled) {
        background: var(--db-accent-hover);
      }

      .db-button:active:not(:disabled) {
        background: var(--db-accent-active);
        transform: translateY(1px);
      }

      .db-button:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--db-accent) 40%, transparent);
      }

      .db-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .db-error {
        margin: 0;
        font-size: 12px;
        color: var(--db-danger);
      }

      .db-hint {
        margin: 0;
        font-size: 11.5px;
        color: var(--db-ink-muted);
      }
    `}</style>
  )
}

export default IndexPopup
