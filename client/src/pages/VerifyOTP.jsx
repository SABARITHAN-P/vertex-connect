import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Key } from "lucide-react";

import api from "@services/api";
import AuthLayout from "../layouts/AuthLayout";

function VerifyOTP() {
  const navigate = useNavigate();

  const userData = JSON.parse(localStorage.getItem("pendingUser"));
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const [errors, setErrors] = useState({});

  // Countdown Timer
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  // Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!otp.trim() || otp.length < 6) {
      newErrors.otp = "Please enter a valid 6-digit OTP";
    }

    if (Object.keys(newErrors).length > 0) {
      return setErrors(newErrors);
    }

    try {
      setLoading(true);
      setErrors({});

      const response = await api.post("/auth/register", {
        ...userData,
        otp,
      });

      toast.success(response.data.message);

      // Save JWT
      localStorage.setItem("token", response.data.token);
      localStorage.removeItem("pendingUser");

      navigate("/login", { replace: true });
    } catch (err) {
      setErrors({
        global: err.response?.data?.message || "Verification failed",
      });
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    try {
      setErrors({});
      const response = await api.post("/auth/send-otp", {
        username: userData.username,
        email: userData.email,
      });

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
      title="Verify OTP"
      subtitle={`OTP sent to ${userData?.email}`}
      mode="security"
    >
      <form onSubmit={handleVerifyOTP} className="space-y-4">
        {/* OTP FIELD */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 select-none block text-center">
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
                setErrors({});
                setOtp(e.target.value);
              }}
              maxLength={6}
              className="w-full text-center tracking-[8px] text-2xl bg-white/60 lg:bg-[#f9fafb] border border-indigo-100/80 lg:border-zinc-200 rounded-xl pl-10 pr-4 py-3.5 outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/5 text-zinc-800 placeholder-zinc-400 transition-all duration-200 font-bold"
            />
          </div>
          {errors.otp && (
            <p className="text-rose-600 text-[11px] font-medium text-center select-none mt-1">
              {errors.otp}
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
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
      </form>

      <div className="mt-6 text-center select-none">
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
      </div>
    </AuthLayout>
  );
}

export default VerifyOTP;
