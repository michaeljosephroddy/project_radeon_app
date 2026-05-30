import React from 'react';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { WelcomeStep } from '../screens/onboarding/WelcomeStep';
import { PhotoStep } from '../screens/onboarding/PhotoStep';
import { IdentityStep } from '../screens/onboarding/IdentityStep';
import { SobrietyStep } from '../screens/onboarding/SobrietyStep';
import { LocationStep } from '../screens/onboarding/LocationStep';
import { InterestsStep } from '../screens/onboarding/InterestsStep';
import { IntentStep } from '../screens/onboarding/IntentStep';

export interface OnboardingStepProps {
    onNext: () => void;
    onBack?: () => void;
    onSkip?: () => void;
    dotIndex: number;
    dotTotal: number;
}

const DOT_TOTAL = 6;

type OnboardingStackParamList = {
    Welcome: undefined;
    Photo: undefined;
    Identity: undefined;
    Sobriety: undefined;
    Location: undefined;
    Interests: undefined;
    Intent: undefined;
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

const DOT_PROPS: Record<Exclude<keyof OnboardingStackParamList, 'Welcome'>, Omit<OnboardingStepProps, 'onNext' | 'onSkip'>> = {
    Photo: { dotIndex: 0, dotTotal: DOT_TOTAL },
    Identity: { dotIndex: 1, dotTotal: DOT_TOTAL },
    Sobriety: { dotIndex: 2, dotTotal: DOT_TOTAL },
    Location: { dotIndex: 3, dotTotal: DOT_TOTAL },
    Interests: { dotIndex: 4, dotTotal: DOT_TOTAL },
    Intent: { dotIndex: 5, dotTotal: DOT_TOTAL },
};

export function OnboardingNavigator(): React.ReactElement {
    return (
        <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
            <OnboardingStack.Screen name="Welcome" component={OnboardingWelcomeScreen} />
            <OnboardingStack.Screen name="Photo" component={OnboardingPhotoScreen} />
            <OnboardingStack.Screen name="Identity" component={OnboardingIdentityScreen} />
            <OnboardingStack.Screen name="Sobriety" component={OnboardingSobrietyScreen} />
            <OnboardingStack.Screen name="Location" component={OnboardingLocationScreen} />
            <OnboardingStack.Screen name="Interests" component={OnboardingInterestsScreen} />
            <OnboardingStack.Screen name="Intent" component={OnboardingIntentScreen} />
        </OnboardingStack.Navigator>
    );
}

function OnboardingWelcomeScreen({ navigation }: NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>): React.ReactElement {
    return <WelcomeStep onNext={() => navigation.navigate('Photo')} />;
}

function OnboardingPhotoScreen({ navigation }: NativeStackScreenProps<OnboardingStackParamList, 'Photo'>): React.ReactElement {
    return (
        <PhotoStep
            onNext={() => navigation.navigate('Identity')}
            onBack={() => navigation.goBack()}
            {...DOT_PROPS.Photo}
        />
    );
}

function OnboardingIdentityScreen({ navigation }: NativeStackScreenProps<OnboardingStackParamList, 'Identity'>): React.ReactElement {
    return (
        <IdentityStep
            onNext={() => navigation.navigate('Sobriety')}
            onBack={() => navigation.goBack()}
            {...DOT_PROPS.Identity}
        />
    );
}

function OnboardingSobrietyScreen({ navigation }: NativeStackScreenProps<OnboardingStackParamList, 'Sobriety'>): React.ReactElement {
    return (
        <SobrietyStep
            onNext={() => navigation.navigate('Location')}
            onBack={() => navigation.goBack()}
            {...DOT_PROPS.Sobriety}
        />
    );
}

function OnboardingLocationScreen({ navigation }: NativeStackScreenProps<OnboardingStackParamList, 'Location'>): React.ReactElement {
    return (
        <LocationStep
            onNext={() => navigation.navigate('Interests')}
            onBack={() => navigation.goBack()}
            {...DOT_PROPS.Location}
        />
    );
}

function OnboardingInterestsScreen({ navigation }: NativeStackScreenProps<OnboardingStackParamList, 'Interests'>): React.ReactElement {
    return (
        <InterestsStep
            onNext={() => navigation.navigate('Intent')}
            onBack={() => navigation.goBack()}
            {...DOT_PROPS.Interests}
        />
    );
}

function OnboardingIntentScreen({ navigation }: NativeStackScreenProps<OnboardingStackParamList, 'Intent'>): React.ReactElement {
    const { completeOnboarding } = useAuth();
    const finish = () => {
        void completeOnboarding();
    };

    return (
        <IntentStep
            onNext={finish}
            onBack={() => navigation.goBack()}
            {...DOT_PROPS.Intent}
        />
    );
}
