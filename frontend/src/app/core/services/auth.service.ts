import { Injectable, signal, computed } from '@angular/core';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { environment } from '@env';

/** AWS Cognitoを使った認証処理を提供するサービス */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /** 現在のIDトークンを保持するシグナル */
  private tokenSignal = signal<string | null>(null);
  /** CognitoユーザープールのSDKインスタンス */
  private userPool: CognitoUserPool;

  /** 現在のIDトークン（読み取り専用） */
  readonly token = this.tokenSignal.asReadonly();
  /** ログイン状態（トークンが存在する場合 true） */
  readonly isLoggedIn = computed(() => !!this.tokenSignal());

  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: environment.cognito.userPoolId,
      ClientId: environment.cognito.clientId,
    });
    this.restoreSession();
  }

  /** ページリロード時にCognitoセッションからトークンを復元する */
  private restoreSession(): void {
    const cognitoUser = this.userPool.getCurrentUser();
    if (!cognitoUser) return;

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        this.tokenSignal.set(null);
        return;
      }
      this.tokenSignal.set(session.getIdToken().getJwtToken());
    });
  }

  /** Cognitoでメールアドレスとパスワードによるログインを行う
   * @param email - メールアドレス
   * @param password - パスワード
   * @returns 成功時は success: true、失敗時は error メッセージを含むオブジェクト
   */
  login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session: CognitoUserSession) => {
          this.tokenSignal.set(session.getIdToken().getJwtToken());
          resolve({ success: true });
        },
        onFailure: (err: Error) => {
          resolve({ success: false, error: err.message });
        },
      });
    });
  }

  /** Cognitoに新規ユーザーを登録する
   * @param email - メールアドレス
   * @param password - パスワード
   * @returns 成功時は success: true、失敗時は error メッセージを含むオブジェクト
   */
  signUp(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.userPool.signUp(email, password, [], [], (err, _result) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        resolve({ success: true });
      });
    });
  }

  /** メールで受け取った確認コードでアカウントを有効化する
   * @param email - メールアドレス
   * @param code - 確認コード
   * @returns 成功時は success: true、失敗時は error メッセージを含むオブジェクト
   */
  confirmSignUp(email: string, code: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.confirmRegistration(code, true, (err, _result) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        resolve({ success: true });
      });
    });
  }

  /** 確認コードを再送する
   * @param email - メールアドレス
   * @returns 成功時は success: true、失敗時は error メッセージを含むオブジェクト
   */
  resendConfirmationCode(email: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.resendConfirmationCode((err, _result) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        resolve({ success: true });
      });
    });
  }

  /** Cognitoからサインアウトしてトークンをクリアし、ログイン画面へ遷移する */
  logout(): void {
    const cognitoUser = this.userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    this.tokenSignal.set(null);
  }

  /** 現在のIDトークンを返す
   * @returns IDトークン文字列、未ログインの場合は null
   */
  getToken(): string | null {
    return this.tokenSignal();
  }
}
