import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "@pages/Login";
import Register from "@pages/Register";
import VerifyOTP from "@pages/VerifyOTP";
import ForgotPassword from "@pages/ForgotPassword";
import ResetPassword from "@pages/ResetPassword";
import ChatPage from "@pages/ChatPage";
import ProtectedRoute from "@components/common/ProtectedRoute";
import { Toaster } from "react-hot-toast";
import { useTheme } from "@context/ThemeContext";

/* SOCKET */
import { socket } from "@socket/socket";

/* =========================
   AUTH CHECK
========================== */
const isAuthenticated = () => {
  return !!localStorage.getItem("userInfo");
};

/* =========================
   ROOT REDIRECT
========================== */
function RootRedirect() {
  return isAuthenticated() ? (
    <Navigate to="/chat" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}

function App() {
  const { theme } = useTheme();

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to Socket Server:", socket.id);
    });

    return () => {
      socket.off("connect");
    };
  }, []);

  return (
    <>
      <Toaster
        position="bottom-left"
        toastOptions={{
          style: {
            background: theme === "dark" ? "#f8fafc" : "#182229",
            color: theme === "dark" ? "#0f172a" : "#f1f5f9",
            fontSize: "13px",
            fontWeight: "500",
            borderRadius: "8px",
            padding: "10px 14px",
            boxShadow: theme === "dark" 
              ? "0 4px 12px rgba(0, 0, 0, 0.25)" 
              : "0 4px 12px rgba(0, 0, 0, 0.35)",
            border: theme === "dark" 
              ? "1px solid rgba(0, 0, 0, 0.06)" 
              : "1px solid rgba(255, 255, 255, 0.08)",
            maxWidth: "350px",
          },
          success: {
            icon: null,
          },
          error: {
            icon: null,
          },
          loading: {
            icon: null,
          },
        }}
      />
      <Routes>
        {/* ROOT */}
        <Route path="/" element={<RootRedirect />} />

      {/* LOGIN */}
      <Route
        path="/login"
        element={
          isAuthenticated() ? <Navigate to="/chat" replace /> : <Login />
        }
      />

      {/* REGISTER */}
      <Route
        path="/register"
        element={
          isAuthenticated() ? <Navigate to="/chat" replace /> : <Register />
        }
      />

      {/* VERIFY OTP */}
      <Route
        path="/verify-otp"
        element={
          isAuthenticated() ? <Navigate to="/chat" replace /> : <VerifyOTP />
        }
      />

      {/* FORGOT PASSWORD */}
      <Route
        path="/forgot-password"
        element={
          isAuthenticated() ? (
            <Navigate to="/chat" replace />
          ) : (
            <ForgotPassword />
          )
        }
      />

      {/* RESET PASSWORD */}
      <Route
        path="/reset-password"
        element={
          isAuthenticated() ? (
            <Navigate to="/chat" replace />
          ) : (
            <ResetPassword />
          )
        }
      />

      {/* CHAT */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />

      {/* INVALID ROUTE */}
      <Route
        path="*"
        element={
          isAuthenticated() ? (
            <Navigate to="/chat" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
    </>
  );
}

export default App;
