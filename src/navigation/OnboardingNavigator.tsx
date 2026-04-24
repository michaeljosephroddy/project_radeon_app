import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WelcomeStep } from '../screens/onboarding/WelcomeStep';
import { PhotoStep } from '../screens/onboarding/PhotoStep';
import { SobrietyStep } from '../screens/onboarding/SobrietyStep';
import { LocationStep } from '../screens/onboarding/LocationStep';
import { InterestsStep } from '../screens/onboarding/InterestsStep';
import { PlusStep } from '../screens/onboarding/PlusStep';
import { ReadyStep } from '../screens/onboarding/ReadyStep';

export interface OnboardingStepProps {
    onNext: () => void;
    onSkip?: () => void;
    dotIndex: number;
    dotTotal: number;
}

const DOT_TOTAL = 5;

export function OnboardingNavigator() {
    const { completeOnboarding } = useAuth();
    const [step, setStep] = useState(0);

    const next = () => setStep(s => s + 1);

    const dotProps = (stepIndex: number): Omit<OnboardingStepProps, 'onNext' | 'onSkip'> => ({
        dotIndex: stepIndex - 1,
        dotTotal: DOT_TOTAL,
    });

    switch (step) {
        case 0: return <WelcomeStep onNext={next} />;
        case 1: return <PhotoStep onNext={next} onSkip={next} {...dotProps(1)} />;
        case 2: return <SobrietyStep onNext={next} onSkip={next} {...dotProps(2)} />;
        case 3: return <LocationStep onNext={next} onSkip={next} {...dotProps(3)} />;
        case 4: return <InterestsStep onNext={next} onSkip={next} {...dotProps(4)} />;
        case 5: return <PlusStep onNext={next} onSkip={next} {...dotProps(5)} />;
        case 6: return <ReadyStep onComplete={completeOnboarding} />;
        default: completeOnboarding(); return null;
    }
}
