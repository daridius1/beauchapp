export type RootStackParamList = {
  Home: { initialFilterTag?: string; initialPostTags?: string[] } | undefined;
  Login: undefined;
  Profile: undefined;
  Contests: undefined;
  PollaContest: { contestId: string };
  ParticipantPredictions: { contestId: string; participantId: string; participantName: string };
  MatchPredictions: { matchId: string; contestId: string };
  Communities: undefined;
  CommunityDetail: { communityId: string; communityName?: string };
  Superadmin: undefined;
  PostDetail: { postId: string };
  UserProfile: { userId: string };
  NotFound: undefined;
  Verification: undefined;
  VerifyEmail: undefined;
  ResetPassword: undefined;
};
