import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import toast from "react-hot-toast";

import api from "@services/api";
import AuthLayout from "../layouts/AuthLayout";

function VerifyOTP() {
  const navigate = useNavigate();

  const userData = JSON.parse(localStorage.getItem("pendingUser"));

  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);

  const [cooldown, setCooldown] = useState(30);

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

    try {
      setLoading(true);

      const response = await api.post("/auth/register", {
        ...userData,
        otp,
      });

      toast.success(response.data.message);

      // Save JWT
      localStorage.setItem("token", response.data.token);

      localStorage.removeItem("pendingUser");

      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    try {
      const response = await api.post("/auth/send-otp", {
        username: userData.username,
        email: userData.email,
      });

      toast.success(response.data.message);

      setCooldown(30);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resend OTP");
    }
  };

  return (
    <AuthLayout title="Verify OTP" subtitle={`OTP sent to ${userData?.email}`}>
      <form onSubmit={handleVerifyOTP} className="space-y-5">
        <input
          type="text"
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength={6}
          className="w-full text-center tracking-[10px] text-2xl bg-app-input border border-app-border rounded-lg px-4 py-3 outline-none focus:border-brand text-app-text-primary placeholder-app-text-secondary/50 transition-colors font-semibold"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand hover:bg-brand/95 text-white transition rounded-lg py-3 font-semibold disabled:opacity-50 cursor-pointer shadow-md shadow-brand/10 hover:shadow-brand/20 active:scale-[0.98]"
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
      </form>

      <div className="mt-6 text-center">
        {cooldown > 0 ? (
          <p className="text-app-text-secondary text-sm">Resend OTP in {cooldown}s</p>
        ) : (
          <button
            onClick={handleResendOTP}
            className="text-brand hover:underline text-sm font-semibold"
          >
            Resend OTP
          </button>
        )}
      </div>
    </AuthLayout>
  );
}

export default VerifyOTP;
