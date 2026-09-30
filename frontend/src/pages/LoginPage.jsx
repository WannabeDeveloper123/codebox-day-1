import { useState } from "react";
import { api } from "../api.js";
import Spinner from "../components/Spinner.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(mode, { name, email, password }) {
  if (mode === "register" && !name.trim()) return "Please enter your name.";
  if (!EMAIL_PATTERN.test(email.trim())) return "Please enter a valid email.";
  if (mode === "register" && password.length < 8) return "Password must be at least 8 characters.";
  if (!password) return "Please enter your password.";
  return null;
}

export default function LoginPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  function switchMode() {
    setMode(isRegister ? "login" : "register");
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = validate(mode, form);
    if (problem) return setError(problem);

    setLoading(true);
    setError(null);
    try {
      const body = isRegister
        ? form
        : { email: form.email, password: form.password };
      onAuth(await api(`/api/auth/${mode}`, { method: "POST", body }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="center">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">🏈 CodeBox Fantasy</p>
        <h1>{isRegister ? "Create an account" : "Welcome back"}</h1>
        <p className="muted">
          {isRegister ? "Sign up to build your fantasy team." : "Log in to manage your team."}
        </p>

        {isRegister && (
          <label>
            Name
            <input value={form.name} onChange={update("name")} autoComplete="name" maxLength={50} />
          </label>
        )}
        <label>
          Email
          <input type="email" value={form.email} onChange={update("email")} autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={update("password")}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" className="primary" disabled={loading}>
          {loading ? <Spinner small label="Submitting" /> : isRegister ? "Sign up" : "Log in"}
        </button>

        <button type="button" className="link" onClick={switchMode}>
          {isRegister ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </form>
    </main>
  );
}
