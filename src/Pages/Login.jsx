
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const email = form.email.trim().toLowerCase();

      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        form.password
      );

      // Refresh user details to get the latest verification status.
      await credential.user.reload();

      if (!credential.user.emailVerified) {
        try {
          await sendEmailVerification(credential.user);
        } catch (verificationError) {
          console.error("Verification email error:", verificationError);
        }

        await signOut(auth);

        setError(
          "Your email is not verified yet. Check your inbox for the verification link. You can try signing in again after verifying."
        );
        return;
      }

      navigate("/", { replace: true });
    } catch (err) {
      console.error("Login error:", err);

      const messages = {
        "auth/invalid-credential":
          "Incorrect email or password. Please check your details.",
        "auth/user-not-found":
          "No account found. Please sign up first.",
        "auth/wrong-password":
          "Incorrect email or password.",
        "auth/invalid-email":
          "Please enter a valid email address.",
        "auth/too-many-requests":
          "Too many attempts. Please try again later.",
        "auth/user-disabled":
          "This account has been disabled.",
      };

      setError(
        messages[err.code] ||
        "Login failed. Please check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "55px 20px",
        boxSizing: "border-box",
      }}
    >

      <div className="project-header">
        <h1>India Energy Analytics</h1>
        <p>Smart Energy Consumption Analysis & Forecasting</p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          marginTop: "77px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              margin: "0 auto 16px",
              background: "linear-gradient(135deg,#F5B042,#E8760A)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 900,
              color: "#000",
            }}
          >
            P
          </div>

          <h2
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: "1.75rem",
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Welcome Back
          </h2>

          <p style={{ color: "var(--text2)", fontSize: 14 }}>
            Sign in to access your energy forecasting dashboard.
          </p>
        </div>

        <div
          className="glass"
          style={{ padding: "36px 32px", overflow: "hidden" }}
        >
          {message && (
            <div
              role="status"
              style={{
                color: "#10b981",
                background: "rgba(16,185,129,0.1)",
                padding: 12,
                borderRadius: 10,
                marginBottom: 20,
                fontSize: 14,
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444",
                padding: 12,
                borderRadius: 10,
                marginBottom: 20,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <div>
                <label
                  className="label"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Email
                </label>

                <input
                  type="email"
                  required
                  className="inp"
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    fontSize: 15,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  className="label"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Password
                </label>

                <input
                  type="password"
                  required
                  className="inp"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    fontSize: 15,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-gold"
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: 10,
                  fontSize: 16,
                  marginTop: 8,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "Signing in..." : "Sign In →"}
              </button>
            </div>
          </form>

          <hr className="divider" style={{ margin: "24px 0" }} />

          <p
            style={{
              textAlign: "center",
              fontSize: 14,
              color: "var(--text2)",
            }}
          >
            Don't have an account?{" "}
            <Link
              to="/signup"
              style={{
                color: "var(--gold)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
