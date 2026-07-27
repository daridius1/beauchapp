import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { ProfilesListScreen } from './ProfilesListScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Directory'>;

export const DirectoryScreen: React.FC<Props> = (props) => {
  return <ProfilesListScreen {...props} />;
};
