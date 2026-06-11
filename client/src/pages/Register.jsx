import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "@services/api";
import AuthLayout from "../layouts/AuthLayout";


function Register() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }

    if (formData.password !== formData.confirmPassword) {
      return toast.error("Passwords do not match");
    }

    try {
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

    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Register to continue to Vertex Connect"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <input
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange}
          className="w-full bg-app-input border border-app-border rounded-lg px-4 py-3 outline-none focus:border-brand text-app-text-primary placeholder-app-text-secondary/50 transition-colors"
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
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

        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleChange}
          className="w-full bg-app-input border border-app-border rounded-lg px-4 py-3 outline-none focus:border-brand text-app-text-primary placeholder-app-text-secondary/50 transition-colors"
        />


        <button
          type="submit"
          className="w-full bg-brand hover:bg-brand/95 text-white transition rounded-lg py-3 font-semibold cursor-pointer shadow-md shadow-brand/10 hover:shadow-brand/20 active:scale-[0.98]"
        >
          Send OTP
        </button>
      </form>

      <p className="text-app-text-secondary text-sm text-center mt-6">
        Already have an account?{" "}
        <Link to="/login" className="text-brand hover:underline font-semibold">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Register;
