// aws-config.ts — Cognito configuration for user pool
import { ResourcesConfig } from 'aws-amplify';
import { Amplify } from 'aws-amplify';

const userPoolConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID ?? '',
      userPoolClientId: process.env.NEXT_PUBLIC_USER_CLIENT_ID ?? '',
      signUpVerificationMethod: 'code',
      loginWith: {
        username: true,
        email: true,
        phone: false,
      },
    },
  },
};

export function configureAmplify() {
  Amplify.configure(userPoolConfig, { ssr: true });
}

export default userPoolConfig;
