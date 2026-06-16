import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Key, Lock, Eye, EyeOff } from "lucide-react";

import api from "@services/api";
import AuthLayout from "../layouts/AuthLayout";

function ResetPassword() {
  const navigate = useNavigate();

  const email = localStorage.getItem("resetEmail");

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const [errors, setErrors] = useState({});

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Countdown
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  // Reset Password
  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!otp.trim() || otp.length < 6) {
      newErrors.otp = "Please enter a valid 6-digit OTP";
    }

    if (newPassword.length < 6) {
      newErrors.newPassword = "Password must be at least 6 characters";
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      return setErrors(newErrors);
    }

    try {
      setLoading(true);
      setErrors({});

      const response = await api.post("/auth/reset-password", {
        email,
        otp,
        newPassword,
        confirmPassword,
      });

      toast.success(response.data.message);

      localStorage.removeItem("resetEmail");

      navigate("/login", { replace: true });
    } catch (err) {
      setErrors({
        global: err.response?.data?.message || "Reset failed",
      });
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    try {
      setErrors({});
      const response = await api.post("/auth/forgot-password", { email });

      toast.success(response.data.message);

      setCooldown(30);
    } catch (err) {
      setErrors({
        global: err.response?.data?.message || "Failed to resend OTP",
      });
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle={`OTP sent to ${email}`}
      mode="security"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* OTP FIELD */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 select-none">
            6-Digit Verification Code
          </label>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 group-focus-within:text-brand transition-colors pointer-events-none">
              <Key size={16} />
            </span>
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => {
                setErrors({ ...errors, otp: "", global: "" });
                setOtp(e.target.value);
              }}
              maxLength={6}
              className="w-full bg-white/60 lg:bg-[#f9fafb] border border-indigo-100/80 lg:border-zinc-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 text-sm font-semibold tracking-wider"
            />
          </div>
          {errors.otp && (
            <p className="text-rose-600 text-[11px] font-medium select-none ml-1">
              {errors.otp}
            </p>
          )}
        </div>

        {/* NEW PASSWORD FIELD */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 select-none">
            New Password
          </label>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 group-focus-within:text-brand transition-colors pointer-events-none">
              <Lock size={16} />
            </span>
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => {
                setErrors({ ...errors, newPassword: "", global: "" });
                setNewPassword(e.target.value);
              }}
              className="w-full bg-white/60 lg:bg-[#f9fafb] border border-indigo-100/80 lg:border-zinc-200 rounded-xl pl-10 pr-10 py-3 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="text-rose-600 text-[11px] font-medium select-none ml-1">
              {errors.newPassword}
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
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setErrors({ ...errors, confirmPassword: "", global: "" });
                setConfirmPassword(e.target.value);
              }}
              className="w-full bg-white/60 lg:bg-[#f9fafb] border border-indigo-100/80 lg:border-zinc-200 rounded-xl pl-10 pr-10 py-3 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 text-sm"
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
          className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white transition rounded-xl py-3 text-sm font-semibold disabled:opacity-50 cursor-pointer shadow-sm shadow-brand/15 hover:shadow-brand/25 active:scale-[0.98] duration-200"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>

      <div className="mt-6 text-center">
        {cooldown > 0 ? (
          <p className="text-zinc-500 text-xs font-semibold">Resend OTP in {cooldown}s</p>
        ) : (
          <button
            onClick={handleResendOTP}
            className="text-xs text-brand hover:underline font-bold uppercase tracking-wider transition cursor-pointer"
          >
            Resend OTP
          </button>
        )}
        <p className="text-[10px] text-zinc-400 mt-2 font-medium">Tip: If you don't see the code, please check your Spam folder.</p>
      </div>
    </AuthLayout>
  );
}

export default ResetPassword;
