import React from 'react';
import { PlusUpsellScreen } from '../../components/PlusUpsellScreen';
import { appAlert } from '../../components/ui/appAlert';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

type PlusStepProps = OnboardingStepProps;

export function PlusStep({ onBack, dotIndex, dotTotal }: PlusStepProps) {
    return (
        <PlusUpsellScreen
            primaryLabel="Choose membership"
            onPrimary={() => appAlert.alert('Subscription checkout', 'Membership checkout is not connected yet.')}
            onBack={onBack}
            dotIndex={dotIndex}
            dotTotal={dotTotal}
        />
    );
}
