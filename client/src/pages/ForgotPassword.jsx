import { useState } from "react";
import { useNavigate } from "react-router-dom";

import toast from "react-hot-toast";

import api from "@services/api";
import AuthLayout from "../layouts/AuthLayout";

function ForgotPassword() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const response = await api.post("/auth/forgot-password", { email });

      toast.success(response.data.message);

      localStorage.setItem("resetEmail", email);

      navigate("/reset-password");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Forgot Password" subtitle="Enter your registered email">
      <form onSubmit={handleSubmit} className="space-y-5">
        <input
          type="email"
          placeholder="Registered Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-app-input border border-app-border rounded-lg px-4 py-3 outline-none focus:border-brand text-app-text-primary placeholder-app-text-secondary/50 transition-colors"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand hover:bg-brand/95 text-white transition rounded-lg py-3 font-semibold disabled:opacity-50 cursor-pointer shadow-md shadow-brand/10 hover:shadow-brand/20 active:scale-[0.98]"
        >
          {loading ? "Sending OTP..." : "Send OTP"}
        </button>
      </form>
      
      <div className="text-center mt-6">
        <button
          onClick={() => navigate("/login")}
          className="text-sm text-brand hover:underline font-semibold"
        >
          Back to Login
        </button>
      </div>
    </AuthLayout>
  );
}

export default ForgotPassword;
