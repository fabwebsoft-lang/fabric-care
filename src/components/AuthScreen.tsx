import { useState } from "react";
import LoginScreen from "./LoginScreen";
import SignupScreen from "./SignupScreen";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return mode === "login" ? (
    <LoginScreen onSwitchToSignup={() => setMode("signup")} />
  ) : (
    <SignupScreen onSwitchToLogin={() => setMode("login")} />
  );
}
