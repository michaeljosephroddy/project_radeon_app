import React from 'react';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { LegalDocumentScreen } from '../components/ui/LegalDocumentScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import type { LegalDocumentKey } from '../utils/legalDocuments';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  LegalDocument: { documentKey: LegalDocumentKey };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

// Switches between the login and registration screens for the auth flow.
export function AuthNavigator(): React.ReactElement {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={AuthLoginScreen} />
      <AuthStack.Screen name="Register" component={AuthRegisterScreen} />
      <AuthStack.Screen name="LegalDocument" component={AuthLegalDocumentScreen} />
    </AuthStack.Navigator>
  );
}

function AuthLoginScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Login'>): React.ReactElement {
  return <LoginScreen onGoToRegister={() => navigation.navigate('Register')} />;
}

function AuthRegisterScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Register'>): React.ReactElement {
  return (
    <RegisterScreen
      onGoToLogin={() => navigation.goBack()}
      onOpenLegalDocument={(documentKey) => navigation.navigate('LegalDocument', { documentKey })}
    />
  );
}

function AuthLegalDocumentScreen({
  route,
  navigation,
}: NativeStackScreenProps<AuthStackParamList, 'LegalDocument'>): React.ReactElement {
  return (
    <LegalDocumentScreen
      documentKey={route.params.documentKey}
      onBack={() => navigation.goBack()}
    />
  );
}
