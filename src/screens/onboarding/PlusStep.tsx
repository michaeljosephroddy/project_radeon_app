import React from 'react';
import { PlusUpsellScreen } from '../../components/PlusUpsellScreen';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

type PlusStepProps = OnboardingStepProps;

export function PlusStep({ onNext, onSkip, dotIndex, dotTotal }: PlusStepProps) {
    return (
        <PlusUpsellScreen
            onPrimary={onNext}
            onDismiss={onSkip ?? onNext}
            dotIndex={dotIndex}
            dotTotal={dotTotal}
        />
    );
}
