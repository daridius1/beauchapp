import { Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
export const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 450);
