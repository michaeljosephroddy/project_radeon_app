import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WelcomeStep } from '../screens/onboarding/WelcomeStep';
import { PhotoStep } from '../screens/onboarding/PhotoStep';
import { IdentityStep } from '../screens/onboarding/IdentityStep';
import { SobrietyStep } from '../screens/onboarding/SobrietyStep';
import { LocationStep } from '../screens/onboarding/LocationStep';
import { InterestsStep } from '../screens/onboarding/InterestsStep';
import { IntentStep } from '../screens/onboarding/IntentStep';
import { FirstFriendStep } from '../screens/onboarding/FirstFriendStep';
import { FirstGroupStep } from '../screens/onboarding/FirstGroupStep';
import { FirstPostStep } from '../screens/onboarding/FirstPostStep';
import { PlusStep } from '../screens/onboarding/PlusStep';
import { ReadyStep } from '../screens/onboarding/ReadyStep';

export interface OnboardingStepProps {
    onNext: () => void;
    onBack?: () => void;
    onSkip?: () => void;
    dotIndex: number;
    dotTotal: number;
}

const DOT_TOTAL = 10;

export function OnboardingNavigator() {
    const { completeOnboarding } = useAuth();
    const [step, setStep] = useState(0);

    const next = () => setStep(s => s + 1);
    const back = () => setStep(s => Math.max(0, s - 1));

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
        case 6: return <IntentStep onNext={next} onBack={back} {...dotProps(6)} />;
        case 7: return <FirstFriendStep onNext={next} onBack={back} {...dotProps(7)} />;
        case 8: return <FirstGroupStep onNext={next} onBack={back} {...dotProps(8)} />;
        case 9: return <FirstPostStep onNext={next} onBack={back} {...dotProps(9)} />;
        case 10: return <PlusStep onNext={next} onBack={back} {...dotProps(10)} />;
        case 11: return <ReadyStep onComplete={completeOnboarding} />;
        default: completeOnboarding(); return null;
    }
}
