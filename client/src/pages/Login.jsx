import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

import api from "@services/api";
import AuthLayout from "../layouts/AuthLayout";

function Login() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });

  const handleChange = (e) => {
    setErrors({
      ...errors,
      [e.target.name]: "",
      global: "",
    });
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!formData.identifier.trim()) {
      newErrors.identifier = "Please enter email or username";
    }
    if (!formData.password) {
      newErrors.password = "Please enter password";
    }

    if (Object.keys(newErrors).length > 0) {
      return setErrors(newErrors);
    }

    try {
      setLoading(true);
      setErrors({});

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
    } catch (err) {
      setErrors({
        global: err.response?.data?.message || "Login failed",
      });

      if (err.response?.data?.showForgotPassword) {
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
      mode="login"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* IDENTIFIER FIELD */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 select-none">
            Email or Username
          </label>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 group-focus-within:text-brand transition-colors pointer-events-none">
              <Mail size={16} />
            </span>
            <input
              type="text"
              name="identifier"
              placeholder="name@example.com or username"
              value={formData.identifier}
              onChange={handleChange}
              className="w-full bg-white/60 lg:bg-[#f9fafb] border border-indigo-100/80 lg:border-zinc-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 text-sm"
            />
          </div>
          {errors.identifier && (
            <p className="text-rose-600 text-[11px] font-medium select-none ml-1">
              {errors.identifier}
            </p>
          )}
        </div>

        {/* PASSWORD FIELD */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center select-none">
            <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400">
              Password
            </label>
            {showForgotPassword && (
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-[10px] text-brand hover:underline font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Forgot Password?
              </button>
            )}
          </div>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 group-focus-within:text-brand transition-colors pointer-events-none">
              <Lock size={16} />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-white/60 lg:bg-[#f9fafb] border border-indigo-100/80 lg:border-zinc-200 rounded-xl pl-10 pr-10 py-3 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-rose-600 text-[11px] font-medium select-none ml-1">
              {errors.password}
            </p>
          )}
        </div>

        {errors.global && (
          <p className="text-rose-600 text-[11px] text-center font-medium select-none">
            {errors.global}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white transition rounded-xl py-3 text-sm font-semibold disabled:opacity-50 cursor-pointer shadow-sm shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] duration-200"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="text-zinc-400 text-xs text-center mt-6 select-none font-medium">
        Don't have an account?{" "}
        <Link to="/register" className="text-brand hover:underline font-bold uppercase tracking-wider ml-1">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
