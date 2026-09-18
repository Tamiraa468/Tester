import { AuthProvider } from "@/components/auth-provider";

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
