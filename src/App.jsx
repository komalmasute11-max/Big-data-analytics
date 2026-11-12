
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { auth } from "./firebase";

import Navbar from "./components/Navbar";
import Login from "./Pages/Login";
import SignUp from "./Pages/SignUp";
import Dashboard from "./Pages/Dashboard";
import Forecast from "./Pages/Forecast";
import StateAnalysis from "./Pages/StateAnalysis";
import Comparison from "./Pages/Comparison";
import Trends from "./Pages/Trends";

function ProtectedRoute({ user, loading, children }) {
  if (loading) {
    return <p style={{ textAlign: "center", padding: 40 }}>
      Checking login...
    </p>;
  }

  if (!user || !user.emailVerified) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

function PublicRoute({ user, loading, children }) {
  if (loading) return <p style={{ textAlign: "center", padding: 40 }}>Checking login...</p>;

  if (user?.emailVerified) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (!currentUser) {
          setUser(null);
          return;
        }

        await currentUser.reload();
        const refreshedUser = auth.currentUser;

        if (refreshedUser?.emailVerified) {
          setUser(refreshedUser);
        } else {
          setUser(null);
          await signOut(auth);
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        setUser(null);
        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute user={user} loading={loading}>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicRoute user={user} loading={loading}>
              <SignUp />
            </PublicRoute>
          }
        />

        <Route path="/" element={
          <ProtectedRoute user={user} loading={loading}>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/state-analysis" element={
          <ProtectedRoute user={user} loading={loading}>
            <StateAnalysis />
          </ProtectedRoute>
        } />

        <Route path="/trends" element={
          <ProtectedRoute user={user} loading={loading}>
            <Trends />
          </ProtectedRoute>
        } />

        <Route path="/comparison" element={
          <ProtectedRoute user={user} loading={loading}>
            <Comparison />
          </ProtectedRoute>
        } />

        <Route path="/forecast" element={
          <ProtectedRoute user={user} loading={loading}>
            <Forecast />
          </ProtectedRoute>
        } />

        <Route path="*" element={
          <Navigate to={user?.emailVerified ? "/" : "/login"} replace />
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
