export type RootStackParamList = {
  Home: { initialFilterTag?: string; initialPostTags?: string[] } | undefined;
  Login: undefined;
  Profile: undefined;
  Contests: undefined;
  PollaContest: { contestId: string };
  ParticipantPredictions: { contestId: string; participantId: string; participantName: string };
  MatchPredictions: { matchId: string; contestId: string };
  Superadmin: undefined;
  PostDetail: { postId: string };
  UserProfile: { userId: string };
};
