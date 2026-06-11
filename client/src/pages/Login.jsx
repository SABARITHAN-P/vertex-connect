import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import toast from "react-hot-toast";

import api from "@services/api";
import AuthLayout from "../layouts/AuthLayout";

function Login() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const response = await api.post("/auth/login", formData);

      // Store user info properly
      localStorage.setItem(
        "userInfo",
        JSON.stringify({
          token: response.data.token,
          ...response.data.user,
        }),
      );

      toast.success(response.data.message);

      navigate("/chat", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");

      if (error.response?.data?.showForgotPassword) {
        setShowForgotPassword(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Login to continue to Vertex Connect"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <input
          type="text"
          name="identifier"
          placeholder="Email or Username"
          value={formData.identifier}
          onChange={handleChange}
          className="w-full bg-app-input border border-app-border rounded-lg px-4 py-3 outline-none focus:border-brand text-app-text-primary placeholder-app-text-secondary/50 transition-colors"
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          className="w-full bg-app-input border border-app-border rounded-lg px-4 py-3 outline-none focus:border-brand text-app-text-primary placeholder-app-text-secondary/50 transition-colors"
        />
        
        {showForgotPassword && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-sm text-brand hover:underline"
            >
              Forgot Password?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand hover:bg-brand/95 text-white transition rounded-lg py-3 font-semibold disabled:opacity-50 cursor-pointer shadow-md shadow-brand/10 hover:shadow-brand/20 active:scale-[0.98]"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="text-app-text-secondary text-sm text-center mt-6">
        Don't have an account?{" "}
        <Link to="/register" className="text-brand hover:underline font-semibold">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
