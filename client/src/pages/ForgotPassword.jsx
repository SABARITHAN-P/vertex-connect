import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Mail } from "lucide-react";

import api from "@services/api";
import AuthLayout from "../layouts/AuthLayout";

function ForgotPassword() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = "Please enter your email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (Object.keys(newErrors).length > 0) {
      return setErrors(newErrors);
    }

    try {
      setLoading(true);
      setErrors({});

      const response = await api.post("/auth/forgot-password", { email });

      toast.success(response.data.message);

      localStorage.setItem("resetEmail", email);

      navigate("/reset-password");
    } catch (err) {
      setErrors({
        global: err.response?.data?.message || "Failed to send OTP",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your registered email"
      mode="security"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setErrors({});
                setEmail(e.target.value);
              }}
              className="w-full bg-white/60 lg:bg-[#f9fafb] border border-indigo-100/80 lg:border-zinc-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 text-sm"
            />
          </div>
          {errors.email && (
            <p className="text-rose-600 text-[11px] font-medium select-none ml-1">
              {errors.email}
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
      
      <div className="text-center mt-6">
        <button
          onClick={() => navigate("/login")}
          className="text-xs text-brand hover:underline font-bold uppercase tracking-wider transition cursor-pointer"
        >
          Back to Login
        </button>
      </div>
    </AuthLayout>
  );
}

export default ForgotPassword;
