import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "@pages/Login";
import Register from "@pages/Register";
import VerifyOTP from "@pages/VerifyOTP";
import ForgotPassword from "@pages/ForgotPassword";
import ResetPassword from "@pages/ResetPassword";
import ChatPage from "@pages/ChatPage";
import ProtectedRoute from "@components/common/ProtectedRoute";

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
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to Socket Server:", socket.id);
    });

    return () => {
      socket.off("connect");
    };
  }, []);

  return (
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
  );
}

export default App;
