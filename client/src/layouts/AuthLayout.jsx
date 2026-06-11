import logo from "@assets/vite.svg";

function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-app-chat text-app-text-primary flex items-center justify-center px-4 relative overflow-hidden premium-grid-pattern">
      <div className="absolute inset-0 bg-gradient-to-tr from-brand/5 via-transparent to-transparent pointer-events-none" />
      <div className="w-full max-w-md bg-app-card border border-app-border rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] relative z-10 transition-colors duration-300">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 text-brand mb-4 select-none">
            <img src={logo} alt="Vertex Connect Logo" className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text-primary font-st-sans">
            Vertex Connect
          </h1>
          <h2 className="text-lg font-semibold mt-6 text-app-text-primary font-st-sans">
            {title}
          </h2>
          <p className="text-app-text-secondary mt-1.5 text-sm">
            {subtitle}
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}

export default AuthLayout;
