export type RootStackParamList = {
  Home: { initialFilterTag?: string; initialPostTags?: string[] } | undefined;
  Login: undefined;
  Profile: { userId?: string } | undefined;
  Communities: undefined;
  Centers: undefined;
  Teams: undefined;
  PostDetail: { postId: string };
  UserProfile: { userId: string; title?: string };
  NotFound: undefined;
  Verification: undefined;
  VerifyEmail: undefined;
  ResetPassword: undefined;
  Settings: undefined;
  Directory: undefined;
  Students: undefined;
  FollowList: { userId: string; type: 'followers' | 'following'; username?: string };
};
