
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";

export default function Signup() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    const username = form.username.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (username.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    if (password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)) {
      setError(
        "Password must have 8 characters, uppercase, lowercase, number and special character."
      );
      return;
    }

    setLoading(true);

    let userCreated = false;

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      userCreated = true;

      await updateProfile(credential.user, {
        displayName: username,
      });

      await sendEmailVerification(credential.user);

      await signOut(auth);

      setIsSuccess(true);
    } catch (err) {
      console.error("Signup error:", err);

      if (userCreated) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error("Sign out error:", signOutError);
        }
      }

      const messages = {
        "auth/email-already-in-use":
          "This email already has an account. Please sign in.",
        "auth/invalid-email":
          "Please enter a valid email address.",
        "auth/weak-password":
          "Please choose a stronger password.",
        "auth/operation-not-allowed":
          "Email/Password sign-in is not enabled in Firebase.",
        "auth/too-many-requests":
          "Too many attempts. Please try again later.",
      };

      setError(
        messages[err.code] ||
        "Account creation or email verification failed. Please try again."
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
          marginTop: "45px",
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
            Create Account
          </h2>

          <p style={{ color: "var(--text2)", fontSize: 14 }}>
            Join Energy Intelligence Dashboard.
          </p>
        </div>

        <div
          className="glass"
          style={{ padding: "36px 32px", overflow: "hidden" }}
        >
          {isSuccess ? (
            <div style={{ textAlign: "center" }}>
              <h3>Email verification sent!</h3>

              <p style={{ color: "var(--text2)", lineHeight: 1.7 }}>
                We sent a verification link to{" "}
                <strong>{form.email.trim()}</strong>.
                Open your inbox and click the link to verify your email.
                Check your spam folder if you cannot find it.
              </p>

              <p style={{ color: "var(--text2)", fontSize: 14 }}>
                After verifying, return here and sign in.
              </p>

              <Link
                to="/login"
                className="btn-gold"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: 14,
                  borderRadius: 10,
                  marginTop: 24,
                  textDecoration: "none",
                }}
              >
                Go to Login
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    color: "#ef4444",
                    padding: 12,
                    borderRadius: 10,
                    marginBottom: 24,
                    fontSize: 14,
                  }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSignup}>
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
                      Username
                    </label>

                    <input
                      type="text"
                      required
                      minLength={3}
                      className="inp"
                      placeholder="Your username"
                      autoComplete="username"
                      style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        fontSize: 15,
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label
                      className="label"
                      style={{ display: "block", marginBottom: 8 }}
                    >
                      Gmail / Email
                    </label>

                    <input
                      type="email"
                      required
                      className="inp"
                      placeholder="you@gmail.com"
                      autoComplete="email"
                      style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        fontSize: 15,
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
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
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        fontSize: 15,
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
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
                    {loading ? "Creating account..." : "Create Account →"}
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
                Already have an account?{" "}
                <Link
                  to="/login"
                  style={{
                    color: "var(--gold)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
