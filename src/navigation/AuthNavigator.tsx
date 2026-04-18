import React, { useState } from 'react';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';

// Switches between the login and registration screens for the auth flow.
export function AuthNavigator() {
  const [screen, setScreen] = useState<'login' | 'register'>('login');

  // Auth is a tiny two-screen flow, so a local toggle is simpler than adding
  // a full navigator just for login/register handoff.
  return screen === 'login'
    ? <LoginScreen onGoToRegister={() => setScreen('register')} />
    : <RegisterScreen onGoToLogin={() => setScreen('login')} />;
}
