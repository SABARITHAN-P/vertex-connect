import logo from "@assets/vite.svg";
import bgImage from "@assets/login_bg.png";
import { 
  Phone,
  PhoneCall, 
  ShieldCheck, 
  Lock, 
  Video,
  User,
  Check,
  UserPlus,
  FileText
} from "lucide-react";

function AuthLayout({ children, title, subtitle, mode = "login" }) {
  // Configs based on mode
  const getContent = () => {
    switch (mode) {
      case "register":
        return {
          badge: "Instant Messaging",
          headline: "Chat freely and securely.",
          desc: "Start direct chats, search contacts, share files, and make private 1-to-1 voice or video calls.",
          visual: (
            <div className="flex flex-col gap-8 w-full max-w-[400px] mx-auto select-none font-sans">
              
              {/* Widget 1: Welcome Greeting Message Card */}
              <div className="w-[280px] self-start bg-white border border-indigo-50 p-4 rounded-2xl shadow-[0_12px_24px_rgba(79,70,229,0.04)] animate-float">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">V</div>
                  <div>
                    <h4 className="font-bold text-zinc-800 text-xs">Vertex Connect</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold">Welcome team</p>
                  </div>
                </div>
                <p className="text-zinc-600 text-[11px] leading-relaxed">
                  "Welcome to your personal messaging space! Create your profile to start chatting with your contacts."
                </p>
              </div>

              {/* Widget 2: Personal Profile Setup card */}
              <div className="w-[280px] self-end bg-white border border-indigo-50 p-4 rounded-2xl shadow-[0_12px_24px_rgba(79,70,229,0.04)] animate-float">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-zinc-400">Your Profile</span>
                  <span className="flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                    <Check size={9} /> Verified
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <User size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-800">johndoe</h4>
                    <p className="text-[10px] text-zinc-400 italic">"Hey there! I am using Vertex Connect."</p>
                  </div>
                </div>
              </div>

              {/* Widget 3: Contact added alert */}
              <div className="w-[280px] self-start bg-white border border-indigo-50 p-3.5 rounded-2xl shadow-[0_12px_24px_rgba(79,70,229,0.04)] animate-float flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <UserPlus size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-800">Alex added</h4>
                  <p className="text-[9px] text-zinc-400 font-semibold">Contact list updated</p>
                </div>
              </div>

            </div>
          ),
        };

      case "security":
        return {
          badge: "Chat Privacy",
          headline: "Lock your private chats.",
          desc: "Keep your sensitive conversations private. Lock specific direct messages behind your personal 4-digit passcode.",
          visual: (
            <div className="flex flex-col gap-8 w-full max-w-[400px] mx-auto select-none font-sans">
              
              {/* Widget 1: Locked Chat Passcode Lock Screen */}
              <div className="w-[280px] self-start bg-white border border-indigo-50 p-4 rounded-2xl shadow-[0_12px_24px_rgba(79,70,229,0.04)] animate-float">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
                    <Lock size={14} />
                  </div>
                  <span className="font-bold text-zinc-800 text-xs uppercase tracking-wider">Locked Conversation</span>
                </div>
                <p className="text-[11px] text-zinc-500 mb-2.5 font-medium">Enter security passcode to unlock this chat</p>
                <div className="flex justify-center gap-2.5 py-1">
                  <div className="w-8 h-8 rounded-lg border-2 border-indigo-600 bg-indigo-50/10 flex items-center justify-center font-bold text-indigo-600 text-sm">*</div>
                  <div className="w-8 h-8 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center font-bold text-zinc-400"></div>
                  <div className="w-8 h-8 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center font-bold text-zinc-400"></div>
                  <div className="w-8 h-8 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center font-bold text-zinc-400"></div>
                </div>
              </div>

              {/* Widget 2: Security Indicator */}
              <div className="w-[280px] self-end bg-white border border-indigo-50 p-4 rounded-2xl shadow-[0_12px_24px_rgba(79,70,229,0.04)] animate-float">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={16} className="text-emerald-500" />
                  <span className="font-bold text-xs uppercase tracking-wider text-zinc-700">Encrypted Chats</span>
                </div>
                <p className="text-[11px] text-zinc-500 font-normal leading-snug">
                  All messages are securely encrypted to ensure complete confidentiality.
                </p>
              </div>

              {/* Widget 3: Key Verification Badge */}
              <div className="w-[280px] self-start bg-white border border-indigo-50 p-3.5 rounded-2xl shadow-[0_12px_24px_rgba(79,70,229,0.04)] animate-float flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <ShieldCheck size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-800">Passcode Enabled</h4>
                  <p className="text-[9px] text-zinc-400 font-semibold">Security configuration active</p>
                </div>
              </div>

            </div>
          ),
        };

      case "login":
      default:
        return {
          badge: "Direct Messaging",
          headline: "Connect with your friends.",
          desc: "Access your direct messages, share files, and start 1-to-1 audio or video calls in one seamless platform.",
          visual: (
            <div className="flex flex-col gap-8 w-full max-w-[400px] mx-auto select-none font-sans">
              
              {/* Widget 1: Mock Chat message */}
              <div className="w-[280px] self-start bg-white border border-indigo-50 p-4 rounded-2xl shadow-[0_12px_24px_rgba(79,70,229,0.04)] animate-float">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">SJ</div>
                    <div>
                      <h4 className="font-bold text-zinc-800 text-xs tracking-tight">Sarah</h4>
                      <p className="text-[9px] text-zinc-400 font-semibold">Active now</p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-zinc-600 text-[11px] leading-relaxed">
                  "Hey! Are you free for a quick voice call? I want to show you the picture I took."
                </p>
              </div>

              {/* Widget 2: 1-to-1 Call Control mockup */}
              <div className="w-[280px] self-end bg-white border border-indigo-50 p-4 rounded-2xl shadow-[0_12px_24px_rgba(79,70,229,0.04)] animate-float flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <PhoneCall size={15} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-zinc-800">Sarah</h4>
                    <p className="text-[9px] text-zinc-400">1-to-1 Voice Call</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-500">
                    <Phone size={12} />
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-500">
                    <Video size={12} />
                  </div>
                </div>
              </div>

              {/* Widget 3: File Sent notification widget */}
              <div className="w-[280px] self-start bg-white border border-indigo-50 p-3.5 rounded-2xl shadow-[0_12px_24px_rgba(79,70,229,0.04)] animate-float flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <FileText size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-800">photo_trip.jpg</h4>
                  <p className="text-[9px] text-zinc-400 font-semibold">Shared in chat</p>
                </div>
              </div>

            </div>
          ),
        };
    }
  };

  const content = getContent();

  return (
    <div className="min-h-screen text-zinc-800 flex relative overflow-hidden select-none bg-white">
      
      {/* LEFT PANEL: SAAS GRADIENT BACKGROUND & DYNAMIC WIDGET STACK (Visible on lg/desktop only) */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden shrink-0 border-r border-indigo-100/40"
        style={{ 
          backgroundImage: 'linear-gradient(135deg, #f5f6ff 0%, #ebecfc 50%, #e1e4fc 100%)' 
        }}
      >
        {/* Soft, Calm Glowing Blobs */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-300/20 blur-[100px] animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-300/15 blur-[120px] animate-float" />
        </div>

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100/85 shadow-sm flex items-center justify-center text-brand">
            <img src={logo} alt="Vertex Connect Logo" className="w-6 h-6" />
          </div>
          <span className="text-zinc-800 font-bold text-base tracking-wider font-st-sans">
            VERTEX CONNECT
          </span>
        </div>

        {/* Dynamic Graphic & Messaging */}
        <div className="relative z-10 max-w-lg my-auto space-y-10 w-full">
          <div className="space-y-3.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-100 text-zinc-500 text-[10px] font-bold tracking-widest uppercase rounded-full shadow-sm">
              {content.badge}
            </span>
            <h2 className="text-4xl font-extrabold text-zinc-800 leading-tight font-st-sans tracking-tight">
              {content.headline}
            </h2>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-md">
              {content.desc}
            </p>
          </div>

          {/* Overlapping Mock-UI Widget Stack */}
          {content.visual}
        </div>

        {/* Showcase Footer */}
        <div className="relative z-10 text-zinc-400 text-[10px] font-bold tracking-widest uppercase">
          Every conversation. Connected.
        </div>
      </div>

      {/* RIGHT PANEL: AUTHENTICATION FORM CARD - HIGHEST CONTRAST CRISP WHITE BACKGROUND */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10 bg-transparent lg:bg-white">
        
        {/* Soft Background shapes & Premium User Illustration for Mobile/Tablet layout */}
        <div className="absolute inset-0 lg:hidden pointer-events-none bg-slate-50">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.85]"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <div className="absolute top-10 left-10 w-48 h-48 rounded-full bg-brand/5 blur-3xl" />
          <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl" />
        </div>

        {/* Clean, Frameless Container on desktop, premium glassmorphic card on mobile */}
        <div className={`w-full max-w-md relative z-20 transition-all duration-300 premium-glass-card rounded-3xl lg:bg-transparent lg:backdrop-blur-none lg:border-none lg:p-0 lg:shadow-none ${
          mode === "register" ? "p-5 sm:p-6" : "p-6 sm:p-8"
        }`}>
          <div className={`${mode === "register" ? "mb-4 lg:mb-8" : "mb-8"} text-center`}>
            {/* Header logo for mobile layout (hidden on lg) */}
            <div className={`lg:hidden inline-flex items-center justify-center rounded-xl bg-white/60 border border-white/40 shadow-sm text-brand select-none ${
              mode === "register" ? "w-10 h-10 mb-2 lg:mb-4" : "w-12 h-12 mb-4"
            }`}>
              <img src={logo} alt="Vertex Connect Logo" className={mode === "register" ? "w-6 h-6" : "w-7 h-7"} />
            </div>
            <h1 className={`lg:hidden font-bold tracking-tight text-zinc-800 font-st-sans ${
              mode === "register" ? "text-xl mb-3 lg:text-2xl lg:mb-5" : "text-2xl mb-5"
            }`}>
              Vertex Connect
            </h1>
            <h2 className={`font-extrabold text-zinc-800 font-st-sans tracking-tight ${
              mode === "register" ? "text-xl lg:text-2xl" : "text-2xl"
            }`}>
              {title}
            </h2>
            <p className={`text-zinc-400 mt-1.5 text-xs lg:text-sm`}>
              {subtitle}
            </p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
