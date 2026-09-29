import React from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { useFonts } from 'expo-font';
import { AllianceId } from '../constants/alliances';

const FONT_SOURCES = {
  AllianceUrbana: require('../../assets/fonts/SedgwickAveDisplay-Regular.ttf'),
  AlliancePop: require('../../assets/fonts/BowlbyOneSC-Regular.ttf'),
  AllianceGotico: require('../../assets/fonts/UnifrakturCook-Bold.ttf'),
  AllianceHiphop: require('../../assets/fonts/BigShouldersStencilText.ttf'),
  AlliancePunk: require('../../assets/fonts/Lacquer-Regular.ttf'),
  AllianceRock: require('../../assets/fonts/NewRocker-Regular.ttf'),
};

const styles = StyleSheet.create({
  urbana: { fontFamily: 'AllianceUrbana', fontWeight: '400', letterSpacing: -0.5 },
  pop: { fontFamily: 'AlliancePop', fontWeight: '400', letterSpacing: 0.6 },
  gotico: { fontFamily: 'AllianceGotico', fontWeight: '400', letterSpacing: 0.2 },
  hiphop: { fontFamily: 'AllianceHiphop', fontWeight: '700', letterSpacing: 1.2 },
  punk: { fontFamily: 'AlliancePunk', fontWeight: '400', letterSpacing: 0.4 },
  rock: { fontFamily: 'AllianceRock', fontWeight: '400', letterSpacing: 0.6 },
});

const ALLIANCE_WORDMARKS: Record<AllianceId, { label: string; style: TextStyle }> = {
  urbana: { label: 'URBANA', style: styles.urbana },
  pop: { label: 'POP', style: styles.pop },
  gotico: { label: 'Gótico', style: styles.gotico },
  hiphop: { label: 'HIP-HOP', style: styles.hiphop },
  punk: { label: 'PUNK', style: styles.punk },
  rock: { label: 'ROCK', style: styles.rock },
};

interface Props extends Omit<TextProps, 'children'> {
  alliance: AllianceId;
}

export const AllianceNameText: React.FC<Props> = ({ alliance, style, ...props }) => {
  const [fontsLoaded] = useFonts(FONT_SOURCES);
  const wordmark = ALLIANCE_WORDMARKS[alliance];

  return (
    <Text
      {...props}
      accessibilityLabel={props.accessibilityLabel || wordmark.label}
      style={[style, fontsLoaded && wordmark.style]}
    >
      {wordmark.label}
    </Text>
  );
};
