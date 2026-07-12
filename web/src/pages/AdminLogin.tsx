import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { adminAPI, ADMIN_SESSION_STORAGE_KEY } from "@/lib/api";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      await adminAPI.login(email, password);
      toast.success("Admin session unlocked");
      navigate("/admin", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="enterprise-bg flex min-h-screen items-center justify-center px-5 py-8 text-white">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00CFE8] text-black shadow-[0_0_42px_rgba(0,207,232,0.2)]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">StreamFlow Admin</h1>
          <p className="mt-2 text-sm text-gray-500">Separate operator access for channel and system management.</p>
        </div>

        <form onSubmit={submit} className="enterprise-panel rounded-3xl p-5 sm:p-6">
          <div className="mb-5 rounded-2xl border border-amber-400/18 bg-amber-400/6 p-3 text-xs leading-relaxed text-amber-100/80">
            Admin panel is isolated from normal user navigation and uses separate server-side admin credentials.
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Admin Console Email</span>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="enterprise-input h-12 w-full rounded-xl pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-[#00CFE8]/60"
                  placeholder="admin@streamflow.app"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Admin Console Password</span>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="enterprise-input h-12 w-full rounded-xl pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-[#00CFE8]/60"
                  placeholder="••••••••••"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00CFE8] text-sm font-black text-black transition-colors hover:bg-[#14E6FF] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Unlock Admin Console
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export { ADMIN_SESSION_STORAGE_KEY as ADMIN_SESSION_KEY };
export default AdminLogin;
