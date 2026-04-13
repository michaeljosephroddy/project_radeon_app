import React, { useState } from 'react';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';

export function AuthNavigator() {
  const [screen, setScreen] = useState<'login' | 'register'>('login');

  return screen === 'login'
    ? <LoginScreen onGoToRegister={() => setScreen('register')} />
    : <RegisterScreen onGoToLogin={() => setScreen('login')} />;
}
