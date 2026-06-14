import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";

import api from "@services/api";
import AuthLayout from "../layouts/AuthLayout";

function Register() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();

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
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      return setErrors(newErrors);
    }

    try {
      setLoading(true);
      setErrors({});
      const response = await api.post("/auth/send-otp", {
        username: formData.username,
        email: formData.email,
      });

      toast.success(response.data.message);

      const userData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      };

      localStorage.setItem("pendingUser", JSON.stringify(userData));

      navigate("/verify-otp");

    } catch (err) {
      setErrors({
        global: err.response?.data?.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Register to continue to Vertex Connect"
      mode="register"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* USERNAME FIELD */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 select-none">
            Username
          </label>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 group-focus-within:text-brand transition-colors pointer-events-none">
              <User size={16} />
            </span>
            <input
              type="text"
              name="username"
              placeholder="johndoe"
              value={formData.username}
              onChange={handleChange}
              className="w-full bg-[#f9fafb] border border-zinc-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 text-sm"
            />
          </div>
          {errors.username && (
            <p className="text-rose-600 text-[11px] font-medium select-none ml-1">
              {errors.username}
            </p>
          )}
        </div>

        {/* EMAIL FIELD */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 select-none">
            Email Address
          </label>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 group-focus-within:text-brand transition-colors pointer-events-none">
              <Mail size={16} />
            </span>
            <input
              type="email"
              name="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-[#f9fafb] border border-zinc-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 text-sm"
            />
          </div>
          {errors.email && (
            <p className="text-rose-600 text-[11px] font-medium select-none ml-1">
              {errors.email}
            </p>
          )}
        </div>

        {/* PASSWORD FIELD */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 select-none">
            Password
          </label>
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
              className="w-full bg-[#f9fafb] border border-zinc-200 rounded-xl pl-10 pr-10 py-3 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 text-sm"
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

        {/* CONFIRM PASSWORD FIELD */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 select-none">
            Confirm Password
          </label>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 group-focus-within:text-brand transition-colors pointer-events-none">
              <Lock size={16} />
            </span>
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full bg-[#f9fafb] border border-zinc-200 rounded-xl pl-10 pr-10 py-3 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-rose-600 text-[11px] font-medium select-none ml-1">
              {errors.confirmPassword}
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
          {loading ? "Sending OTP..." : "Send OTP"}
        </button>
      </form>

      <p className="text-zinc-400 text-xs text-center mt-6 select-none font-medium">
        Already have an account?{" "}
        <Link to="/login" className="text-brand hover:underline font-bold uppercase tracking-wider ml-1">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Register;
