export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Profile: undefined;
  Contests: undefined;
  PollaContest: { contestId: string };
  ParticipantPredictions: { contestId: string; participantId: string; participantName: string };
  MatchPredictions: { matchId: string; contestId: string };
  Superadmin: undefined;
};
