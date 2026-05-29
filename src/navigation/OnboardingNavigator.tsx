import React, { useState } from 'react';
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

export function OnboardingNavigator() {
    const { completeOnboarding } = useAuth();
    const [step, setStep] = useState(0);

    const next = () => setStep(s => s + 1);
    const back = () => setStep(s => Math.max(0, s - 1));
    const finish = () => {
        void completeOnboarding();
    };

    const dotProps = (stepIndex: number): Omit<OnboardingStepProps, 'onNext' | 'onSkip'> => ({
        dotIndex: stepIndex - 1,
        dotTotal: DOT_TOTAL,
    });

    switch (step) {
        case 0: return <WelcomeStep onNext={next} />;
        case 1: return <PhotoStep onNext={next} onBack={back} {...dotProps(1)} />;
        case 2: return <IdentityStep onNext={next} onBack={back} {...dotProps(2)} />;
        case 3: return <SobrietyStep onNext={next} onBack={back} {...dotProps(3)} />;
        case 4: return <LocationStep onNext={next} onBack={back} {...dotProps(4)} />;
        case 5: return <InterestsStep onNext={next} onBack={back} {...dotProps(5)} />;
        case 6: return <IntentStep onNext={finish} onBack={back} {...dotProps(6)} />;
        default: return null;
    }
}
