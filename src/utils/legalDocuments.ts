export const SUPPORT_EMAIL = 'soberspacesupport@gmail.com';

export type LegalDocumentKey = 'terms' | 'privacy' | 'guidelines' | 'support';

export interface LegalDocumentSection {
    title: string;
    body?: string[];
    bullets?: string[];
}

export interface LegalDocument {
    key: LegalDocumentKey;
    label: string;
    title: string;
    lead: string;
    effectiveDate: string;
    notice?: string;
    sections: LegalDocumentSection[];
}

export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
    terms: {
        key: 'terms',
        label: 'Terms of Use',
        title: 'SoberSpace Terms of Use',
        lead: 'These Terms govern your access to and use of SoberSpace. By creating an account or using the service, you agree to these Terms and our Community Guidelines.',
        effectiveDate: 'May 30, 2026',
        notice: 'SoberSpace is not emergency care. If you may hurt yourself or someone else, call emergency services or a crisis hotline immediately.',
        sections: [
            {
                title: 'Eligibility',
                body: [
                    'You must be at least 18 years old to use SoberSpace, including social, community, chat, meetup, and dating features.',
                    'You must provide accurate account information, keep your login credentials secure, and may not create an account for someone else.',
                ],
            },
            {
                title: 'The Service',
                body: [
                    'SoberSpace is a sober social community app. Features may include profiles, feeds, comments, reactions, groups, support requests, Reach Out signals, meetups, recovery meeting listings, discovery, dating, matches, chats, reporting, blocking, subscriptions, boosts, and notifications.',
                    'Dating is optional. Social features and dating features may operate separately, but the same account safety rules apply across the app.',
                ],
            },
            {
                title: 'No Medical or Professional Advice',
                body: [
                    'SoberSpace and user content are for community and informational purposes only. We do not provide medical care, diagnosis, therapy, crisis intervention, detox services, legal advice, sponsor services, or professional treatment.',
                    'Always seek qualified professional help for medical, mental health, addiction, legal, or emergency needs.',
                ],
            },
            {
                title: 'Your Content',
                body: [
                    'You are responsible for content you submit, including posts, comments, photos, profile details, dating profile details, groups, meetups, support requests, Reach Out signals, reports, and messages.',
                    'You keep ownership of your content, but you grant SoberSpace a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display, transmit, modify for formatting, moderate, and distribute your content as needed to operate, improve, secure, and promote the service.',
                ],
            },
            {
                title: 'Community Rules',
                body: [
                    'You must follow our Community Guidelines. You may not post or send content that includes harassment, threats, hate, sexual exploitation, illegal activity, spam, impersonation, deceptive behavior, instructions for self-harm, or encouragement of unsafe substance use.',
                    'You may not use SoberSpace to exploit vulnerable people, sell substances, solicit sexual services, arrange compensated dating, or interfere with the service.',
                ],
            },
            {
                title: 'Dating Conduct',
                body: [
                    'Dating features are for consenting adults only. Be honest, respect boundaries, and use reporting or blocking if someone makes you uncomfortable.',
                    'Do not use dating features for sexual exploitation, harassment, coercion, scams, commercial sexual activity, compensated arrangements, impersonation, or sharing explicit content where it is not allowed.',
                ],
            },
            {
                title: 'Recovery and Safety Conduct',
                body: [
                    'Respect other users privacy and recovery boundaries. Do not pressure anyone to disclose personal history, location, sobriety status, contact information, relapse details, meeting attendance, or treatment information.',
                    'Do not present yourself as a licensed professional, sponsor, crisis responder, or official representative unless that is accurate and authorized.',
                ],
            },
            {
                title: 'Meetups and Real-World Interactions',
                body: [
                    'Users may create or attend meetups. SoberSpace does not screen all organizers or attendees and does not control real-world events.',
                    'Use good judgment, meet in public places when appropriate, tell someone where you are going, and report concerning behavior.',
                ],
            },
            {
                title: 'Moderation and Enforcement',
                body: [
                    'We may review, remove, limit, hide, or refuse content; restrict features; suspend accounts; ban users; preserve evidence; or notify authorities when we believe it is appropriate for safety, legal, or policy reasons.',
                    'We may use automated moderation tools and human review. We are not obligated to monitor all content and moderation decisions may not catch every violation.',
                ],
            },
            {
                title: 'Reports and Blocking',
                body: [
                    'SoberSpace provides tools to report content, report users, block users, mute authors, and hide content. Reports should be made in good faith.',
                    'Abuse of reporting tools may lead to account action.',
                ],
            },
            {
                title: 'Subscriptions, Boosts, and App Stores',
                body: [
                    'Some dating features may require payment. Purchase terms, renewal details, cancellation controls, and refund handling are provided through the applicable app store purchase flow.',
                    'If you download SoberSpace from Apple App Store or Google Play, your use may also be subject to the applicable store terms. Apple and Google are not responsible for SoberSpace content, support, or user activity.',
                ],
            },
            {
                title: 'Account Deletion',
                body: [
                    'If you created an account, you can request account deletion from Settings in the app. Some information may be retained or anonymized where needed for legal, security, safety, backup, or integrity reasons.',
                ],
            },
            {
                title: 'Contact',
                body: [`Questions about these Terms can be sent to ${SUPPORT_EMAIL}.`],
            },
        ],
    },
    privacy: {
        key: 'privacy',
        label: 'Privacy Policy',
        title: 'SoberSpace Privacy Policy',
        lead: 'This Privacy Policy explains how SoberSpace collects, uses, shares, and protects information when you use the SoberSpace mobile app, website, and related services.',
        effectiveDate: 'May 30, 2026',
        notice: 'Recovery privacy matters. Please think carefully before sharing personal recovery, health, location, or contact information in public posts, groups, meetups, profiles, dating, or chats.',
        sections: [
            {
                title: 'Information We Collect',
                bullets: [
                    'Account information: username, email address, password hash, birth date, sober date, city, country, profile details, interests, connection preferences, dating mode, and account settings.',
                    'User content: posts, comments, group content, meetups, support requests, Reach Out signals, profile bio, dating profile details, photos, reports, reactions, and messages.',
                    'Location information: city and country that you provide, approximate location derived from your device when you choose location-based features, and meetup or recovery meeting search locations.',
                    'Dating information: dating preferences, likes, passes, matches, dating chats, subscription status, boosts, and safety interactions related to dating features.',
                    'Photos and media: images you choose to upload for avatars, posts, groups, meetups, or dating profiles. We do not access your photo library unless you grant permission and select media.',
                    'Notifications: push notification tokens and notification preferences if you enable notifications.',
                    'Safety and moderation information: reports, blocks, hidden content, muted authors, moderation decisions, and related audit records.',
                    'Technical information: device type, app version, IP address, request logs, error data, authentication events, and security signals.',
                ],
            },
            {
                title: 'How We Use Information',
                bullets: [
                    'To create and maintain your account.',
                    'To show community feeds, groups, profiles, chats, support requests, Reach Out signals, meetups, recovery meeting listings, dating profiles, matches, and discovery results.',
                    'To personalize content, search, recommendations, distance filters, dating suggestions, subscription features, boosts, and notification preferences.',
                    'To provide safety tools, content moderation, abuse prevention, reporting, blocking, account deletion, and customer support.',
                    'To send service messages, push notifications, security notices, and product updates when permitted.',
                    'To debug, secure, measure, and improve SoberSpace.',
                    'To comply with legal obligations and enforce our Terms and Community Guidelines.',
                ],
            },
            {
                title: 'How Information Is Shared',
                bullets: [
                    'With other users: profile details, dating profile details, posts, comments, group activity, meetup participation, and other content may be visible depending on the feature and your settings.',
                    'With chat participants: direct, group, support, Reach Out, and match chat messages are visible to the people in that conversation.',
                    'With service providers: we use vendors for hosting, database storage, media storage, push notifications, email or form handling, analytics, security, payments, and content moderation.',
                    'For safety and enforcement: reports and related content may be reviewed by moderators or administrators to investigate abuse, safety concerns, policy violations, or legal requests.',
                    'For legal reasons: we may disclose information if required by law, court order, valid legal process, or to protect rights, safety, users, or the service.',
                    'Business transfers: if SoberSpace is involved in a merger, acquisition, financing, or asset sale, information may be transferred as part of that transaction, subject to this Policy or a policy with materially similar protections.',
                ],
            },
            {
                title: 'Public Content and Recovery Information',
                body: [
                    'Do not post information you would not want others to see. Public or group content can be copied, saved, screenshotted, or reshared by other users.',
                    'Sober dates, recovery milestones, group participation, meetups, support requests, dating preferences, and Reach Out signals may reveal sensitive information about you.',
                ],
            },
            {
                title: 'Content Moderation',
                body: [
                    'We may use automated tools and human review to help detect spam, harassment, hate, sexual content, violence, self-harm content, illegal activity, and other harmful content.',
                    'Text and images may be processed by trusted moderation providers for this purpose. Moderation is not perfect, and users should still report content or users that appear unsafe.',
                ],
            },
            {
                title: 'Data Retention',
                body: [
                    'We keep information for as long as needed to provide SoberSpace, comply with legal obligations, resolve disputes, enforce policies, maintain security, and operate backups.',
                    'Some safety records, reports, moderation logs, fraud-prevention records, purchase records, or legal records may be retained after account deletion where necessary.',
                ],
            },
            {
                title: 'Account Deletion',
                body: [
                    'You can request account deletion inside the app from Settings. Deletion removes or deactivates your account access and private profile details.',
                    'Some content may remain if needed for safety, legal, integrity, backup, or community continuity reasons, or may be anonymized instead of deleted.',
                ],
            },
            {
                title: 'Your Choices',
                bullets: [
                    'You can update many profile and dating details in the app.',
                    'You can control device permissions, including location, notifications, and photo access, in your device settings.',
                    'You can block users, report users or content, mute authors, and hide content in the app.',
                    'You can contact us to request access, correction, deletion, or other privacy help where available under applicable law.',
                ],
            },
            {
                title: 'Children and Age Requirement',
                body: [
                    'SoberSpace is for users who are 18 years old or older. We do not knowingly allow users under 18 to create accounts. If you believe someone under 18 is using SoberSpace, contact us.',
                ],
            },
            {
                title: 'Security',
                body: [
                    'We use technical and organizational safeguards designed to protect information, including encrypted token storage in the app and secure transport for network requests. No system is completely secure, so please use a strong password and report suspicious activity.',
                ],
            },
            {
                title: 'International Users',
                body: [
                    'Your information may be processed in countries other than where you live. Those countries may have different data protection laws. Where required, we use appropriate safeguards for cross-border transfers.',
                ],
            },
            {
                title: 'Contact',
                body: [`Questions about privacy or data requests can be sent to ${SUPPORT_EMAIL}.`],
            },
        ],
    },
    guidelines: {
        key: 'guidelines',
        label: 'Community Guidelines',
        title: 'SoberSpace Community Guidelines',
        lead: 'SoberSpace exists to help people build sober connections, find support, and participate in recovery community. These Guidelines apply to profiles, dating profiles, posts, comments, groups, support requests, Reach Out signals, meetups, chats, photos, reports, and any other user content.',
        effectiveDate: 'May 30, 2026',
        sections: [
            {
                title: 'Core Expectations',
                bullets: [
                    'Be respectful. Treat people as humans, including when they are struggling, newly sober, returning after relapse, or working a different recovery path than yours.',
                    'Protect privacy. Do not pressure people to share recovery history, real name, address, workplace, meeting attendance, treatment details, phone number, or exact location.',
                    'Keep support safe. Share lived experience and encouragement without presenting yourself as emergency care, medical treatment, therapy, legal advice, or a guaranteed solution.',
                    'Use reports and blocks. Report content or users that appear unsafe, abusive, exploitative, or against these Guidelines. Block users when you need distance.',
                ],
            },
            {
                title: 'Prohibited Content and Behavior',
                bullets: [
                    'Harassment, bullying, stalking, intimidation, threats, humiliation, unwanted sexual attention, or repeated unwanted contact.',
                    'Hate speech, slurs, dehumanization, or attacks based on protected characteristics.',
                    'Sexual exploitation, sexual content involving minors, non-consensual intimate content, sexual solicitation, compensated dating, or sexually explicit content in public community spaces.',
                    'Violence, credible threats, graphic violence, praise of violent acts, or instructions to commit harm.',
                    'Self-harm instructions, encouragement of suicide or self-injury, or content that exploits someone in crisis.',
                    'Promotion, sale, sourcing, or facilitation of illegal drugs, controlled substances, alcohol misuse, weapons, or other illegal goods or services.',
                    'Encouraging relapse, glamorizing unsafe substance use, or targeting people in recovery with triggering or exploitative substance-related content.',
                    'Spam, scams, phishing, fake giveaways, manipulative fundraising, deceptive links, bot activity, or unsolicited commercial promotion.',
                    'Impersonation, false professional credentials, fake recovery status, misleading identities, or pretending to represent SoberSpace.',
                    'Doxxing, sharing someone else private information, outing recovery status, or posting screenshots of private conversations without consent.',
                    'Illegal activity, evading bans, exploiting bugs, scraping, attempting unauthorized access, or interfering with the service.',
                ],
            },
            {
                title: 'Dating Safety',
                body: [
                    'Dating is opt-in and for adults only. Do not use dating to pressure, shame, harass, coerce, scam, sexually exploit, or repeatedly contact someone who has not welcomed it.',
                    'Report and block anyone who violates boundaries or makes you feel unsafe.',
                ],
            },
            {
                title: 'Recovery Support Boundaries',
                body: [
                    'Support is strongest when it respects boundaries. Do not demand immediate replies, pressure someone into a one-on-one chat, shame someone for relapse, tell someone to stop prescribed medication, or insist that one recovery path is the only valid path.',
                ],
            },
            {
                title: 'Crisis and Emergency Situations',
                body: [
                    'SoberSpace is not a crisis service. If someone appears to be in immediate danger, contact emergency services or a local crisis hotline. You may also report the content in SoberSpace so moderators can review it.',
                ],
            },
            {
                title: 'Meetups',
                body: [
                    'Meetups should be lawful, accurately described, and recovery-safe. Do not create meetups for substance use, unsafe private gatherings, harassment, sexual solicitation, illegal sales, or deceptive activity.',
                ],
            },
            {
                title: 'Groups',
                body: [
                    'Group owners and moderators should set clear expectations, handle reports in good faith, and remove content that violates these Guidelines. SoberSpace may still take action on groups or group members when needed for safety or policy enforcement.',
                ],
            },
            {
                title: 'Reporting and Blocking',
                body: [
                    'Use in-app reporting tools to report posts, comments, group content, chats, messages, or users. Reports are reviewed for safety and policy enforcement.',
                    'Blocking a user limits their ability to interact with you in supported areas of the app. Do not misuse reporting to harass or silence people you simply disagree with.',
                ],
            },
            {
                title: 'Moderation Actions',
                body: [
                    'SoberSpace may remove content, limit distribution, warn users, restrict features, suspend accounts, ban accounts, preserve evidence, or contact authorities when necessary. Severe violations may result in immediate removal without warning.',
                ],
            },
            {
                title: 'Appeals and Questions',
                body: [
                    `If you believe moderation action was a mistake, contact ${SUPPORT_EMAIL} with your username, the action taken, and any relevant context. We may not be able to provide details about reports made by other users.`,
                ],
            },
        ],
    },
    support: {
        key: 'support',
        label: 'Contact Support',
        title: 'SoberSpace Support and Safety',
        lead: 'Use this page for app support, account help, privacy requests, safety concerns, and store review support links.',
        effectiveDate: 'May 30, 2026',
        notice: 'Not for emergencies. SoberSpace support cannot provide emergency help, medical care, therapy, detox services, crisis response, or urgent monitoring. If you or someone else is in immediate danger, call emergency services now.',
        sections: [
            {
                title: 'Contact Support',
                body: [`Email ${SUPPORT_EMAIL} for help with account access, app issues, privacy requests, safety concerns, moderation appeals, or questions about SoberSpace.`],
            },
            {
                title: 'Report Content or Users',
                body: [
                    'The fastest way to report safety issues is inside the app. Use the report menu on posts, comments, groups, chats, messages, dating profiles, or user profiles.',
                    'Reports may be reviewed along with related content and account information so we can enforce our Terms and Community Guidelines.',
                ],
            },
            {
                title: 'Block Users',
                body: [
                    'You can block users in the app when you do not want them to interact with you. Blocking is a personal safety tool and can be used even if the other person has not violated a rule.',
                ],
            },
            {
                title: 'Account Deletion',
                body: [
                    'You can request deletion in the app from Settings. Removing the app from your device does not delete your SoberSpace account.',
                ],
            },
            {
                title: 'Privacy Requests',
                body: [
                    'For privacy or data requests, email support and include the email address or username associated with your account. We may need to verify your identity before acting on a request.',
                ],
            },
            {
                title: 'Moderation Appeals',
                body: [
                    'If you believe content removal, account suspension, or another moderation action was a mistake, email support with your username and relevant context. We may not share details about other users or confidential safety signals.',
                ],
            },
        ],
    },
};
