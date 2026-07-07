export type RootStackParamList = {
  Home: { initialFilterTag?: string; initialPostTags?: string[] } | undefined;
  Login: undefined;
  Profile: undefined;
  Communities: undefined;
  CommunityDetail: { communityId: string; communityName?: string };
  Centers: undefined;
  Teams: undefined;
  TeamDetail: { teamId: string; teamName?: string };
  PostDetail: { postId: string };
  UserProfile: { userId: string };
  NotFound: undefined;
  Verification: undefined;
  VerifyEmail: undefined;
  ResetPassword: undefined;
};
