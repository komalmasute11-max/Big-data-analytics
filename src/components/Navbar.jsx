
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function Navbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      alert("Unable to logout. Please try again.");
    }
  };

  return (
    <nav
      style={{
        background: "rgb(36 42 56)",
        padding: "15px 30px",
      }}
    >
      <h2 style={{ color: "white", margin: 0 }}>
        India Energy Analytics
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: "12px",
          width: "100%",
          gap: "25px",
        }}
      >
        <Link to="/" className="nav-link">Dashboard</Link>
        <Link to="/state-analysis" className="nav-link">State Analysis</Link>
        <Link to="/trends" className="nav-link">Trends</Link>
        <Link to="/comparison" className="nav-link">Comparison</Link>
        <Link to="/forecast" className="nav-link">Forecast</Link>

        <button
          onClick={handleLogout}
          style={{
            background: "#E8760A",
            color: "white",
            border: "none",
            padding: "9px 20px",
            borderRadius: "6px",
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
