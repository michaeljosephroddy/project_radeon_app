import React from 'react';
import { StyleSheet, View } from 'react-native';
import * as api from '../../api/client';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { screenStandards } from '../../styles/screenStandards';
import { GroupsScreen } from './GroupsScreen';
import { MeetupsScreen } from './MeetupsScreen';

export type CommunityHubSurface = 'groups' | 'meetups';

interface CommunityHubScreenProps {
    isActive: boolean;
    activeSurface: CommunityHubSurface;
    onChangeSurface: (surface: CommunityHubSurface) => void;
    onOpenGroup: (groupId: string) => void;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onOpenMeetup: (meetup: api.Meetup) => void;
    onOpenManageMeetup: (meetup: api.Meetup) => void;
    onGroupJoined?: (group: api.Group) => void;
    onRsvpComplete?: (meetup: api.Meetup, result: api.MeetupRsvpResult) => void;
}

export function CommunityHubScreen({
    isActive,
    activeSurface,
    onChangeSurface,
    onOpenGroup,
    onOpenUserProfile,
    onOpenMeetup,
    onOpenManageMeetup,
    onGroupJoined,
    onRsvpComplete,
}: CommunityHubScreenProps): React.ReactElement {
    const groupsActive = isActive && activeSurface === 'groups';
    const meetupsActive = isActive && activeSurface === 'meetups';

    const surfaceTabs = (
        <View style={screenStandards.pageTabsWrap}>
            <SegmentedControl
                items={[
                    { key: 'groups', label: 'Groups' },
                    { key: 'meetups', label: 'Meetups' },
                ]}
                activeKey={activeSurface}
                onChange={(next) => onChangeSurface(next as CommunityHubSurface)}
                layer="page"
                tone="primary"
                style={screenStandards.pageTabsControl}
            />
        </View>
    );

    if (activeSurface === 'meetups') {
        return (
            <View style={styles.container}>
                {surfaceTabs}
                <MeetupsScreen
                    isActive={meetupsActive}
                    onOpenUserProfile={onOpenUserProfile}
                    onOpenMeetup={onOpenMeetup}
                    onOpenManageMeetup={onOpenManageMeetup}
                    onRsvpComplete={onRsvpComplete}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {surfaceTabs}
            <GroupsScreen
                isActive={groupsActive}
                onOpenGroup={onOpenGroup}
                onGroupJoined={onGroupJoined}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
});
