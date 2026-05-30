import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, IconSizes, Radius, Spacing, TextStyles } from '../../theme';
import { LEGAL_DOCUMENTS, SUPPORT_EMAIL, type LegalDocumentKey, type LegalDocumentSection } from '../../utils/legalDocuments';
import { appAlert } from './appAlert';
import { PrimaryButton } from './PrimaryButton';
import { ScreenHeader } from './ScreenHeader';

interface LegalDocumentScreenProps {
    documentKey: LegalDocumentKey;
    onBack: () => void;
}

export function LegalDocumentScreen({
    documentKey,
    onBack,
}: LegalDocumentScreenProps): React.ReactElement {
    const document = LEGAL_DOCUMENTS[documentKey];

    const handleEmailSupport = async (): Promise<void> => {
        try {
            await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
        } catch {
            appAlert.alert('Could not open email', SUPPORT_EMAIL);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ScreenHeader title={document.label} onBack={onBack} />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.title}>{document.title}</Text>
                <Text style={styles.lead}>{document.lead}</Text>
                <Text style={styles.effectiveDate}>Effective date: {document.effectiveDate}</Text>

                {document.notice ? (
                    <View style={styles.notice}>
                        <Ionicons name="alert-circle-outline" size={IconSizes.row} color={Colors.warning} />
                        <Text style={styles.noticeText}>{document.notice}</Text>
                    </View>
                ) : null}

                {document.sections.map((section) => (
                    <DocumentSection key={section.title} section={section} />
                ))}

                <PrimaryButton
                    label="Email support"
                    variant="secondary"
                    onPress={handleEmailSupport}
                    style={styles.emailButton}
                    leftAdornment={<Ionicons name="mail-outline" size={IconSizes.inline} color={Colors.textOn.primary} />}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

function DocumentSection({ section }: { section: LegalDocumentSection }): React.ReactElement {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.body?.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
            ))}
            {section.bullets?.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>{'\u2022'}</Text>
                    <Text style={styles.bulletText}>{bullet}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    scroll: {
        flex: 1,
    },
    content: {
        padding: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    title: {
        ...TextStyles.screenTitle,
        textAlign: 'left',
    },
    lead: {
        ...TextStyles.body,
        marginTop: Spacing.sm,
        color: Colors.text.secondary,
    },
    effectiveDate: {
        ...TextStyles.meta,
        marginTop: Spacing.sm,
    },
    notice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        marginTop: Spacing.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.warning,
        borderRadius: Radius.md,
        padding: Spacing.md,
        backgroundColor: Colors.warningSubtle,
    },
    noticeText: {
        ...TextStyles.secondary,
        flex: 1,
        color: Colors.text.primary,
    },
    section: {
        marginTop: Spacing.lg,
    },
    sectionTitle: {
        ...TextStyles.sectionTitle,
        color: Colors.text.primary,
    },
    paragraph: {
        ...TextStyles.body,
        marginTop: Spacing.sm,
        color: Colors.text.secondary,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    bulletDot: {
        ...TextStyles.body,
        color: Colors.primary,
        width: 14,
    },
    bulletText: {
        ...TextStyles.body,
        flex: 1,
        color: Colors.text.secondary,
    },
    emailButton: {
        marginTop: Spacing.xl,
    },
});
