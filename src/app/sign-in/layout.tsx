import { AuthProvider } from "@/components/auth-provider";

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
