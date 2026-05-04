import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WelcomeStep } from '../screens/onboarding/WelcomeStep';
import { PhotoStep } from '../screens/onboarding/PhotoStep';
import { IdentityStep } from '../screens/onboarding/IdentityStep';
import { SobrietyStep } from '../screens/onboarding/SobrietyStep';
import { LocationStep } from '../screens/onboarding/LocationStep';
import { InterestsStep } from '../screens/onboarding/InterestsStep';
import { IntentStep } from '../screens/onboarding/IntentStep';
import { PlusStep } from '../screens/onboarding/PlusStep';
import { ReadyStep } from '../screens/onboarding/ReadyStep';

export interface OnboardingStepProps {
    onNext: () => void;
    onSkip?: () => void;
    dotIndex: number;
    dotTotal: number;
}

const DOT_TOTAL = 7;

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
        case 2: return <IdentityStep onNext={next} onSkip={next} {...dotProps(2)} />;
        case 3: return <SobrietyStep onNext={next} onSkip={next} {...dotProps(3)} />;
        case 4: return <LocationStep onNext={next} onSkip={next} {...dotProps(4)} />;
        case 5: return <InterestsStep onNext={next} onSkip={next} {...dotProps(5)} />;
        case 6: return <IntentStep onNext={next} onSkip={next} {...dotProps(6)} />;
        case 7: return <PlusStep onNext={next} onSkip={next} {...dotProps(7)} />;
        case 8: return <ReadyStep onComplete={completeOnboarding} />;
        default: completeOnboarding(); return null;
    }
}
