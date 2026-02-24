/** 本番環境の設定値 */
/** userPoolId / clientId は GitHub Actions でビルド時に注入される */
export const environment = {
  /** 本番環境フラグ */
  production: true,
  /** バックエンドAPIのベースURL */
  apiUrl: '/api/v1',
  /** AWS Cognitoの設定 */
  cognito: {
    /** CognitoユーザープールID（GitHub Secret: COGNITO_USER_POOL_ID） */
    userPoolId: '',
    /** CognitoアプリクライアントID（GitHub Secret: COGNITO_CLIENT_ID） */
    clientId: '',
  },
};
