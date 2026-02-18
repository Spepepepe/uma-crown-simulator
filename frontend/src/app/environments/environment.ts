/** 本番環境の設定値 */
export const environment = {
  /** 本番環境フラグ */
  production: true,
  /** バックエンドAPIのベースURL */
  apiUrl: '/api/v1',
  /** AWS Cognitoの設定 */
  cognito: {
    /** CognitoユーザープールID */
    userPoolId: 'us-east-1_BP54ZLy05',
    /** CognitoアプリクライアントID */
    clientId: '52l1cai17dsb8nhf3babjnpaf6',
  },
};
